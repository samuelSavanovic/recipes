// Hand-written service worker (no workbox/serwist) for full visibility into the
// caching strategy — the fiddliest surface. VERSION is stamped at build time by
// scripts/stamp-sw.mjs so every deploy ships a byte-different SW that reinstalls
// and purges old caches. IndexedDB (not this cache) is the real offline read
// store; the SW makes the app shell + last-seen pages openable offline.

const VERSION = '__SW_VERSION__'
const CACHE = `recipes-${VERSION}`

// Deliberately unversioned. next/font hashes the woff2 filename, so a new build
// yields a new URL — the cache contents self-invalidate without the cache name
// rotating. Keeping it out of the version stamp means the font survives every
// deploy instead of being re-downloaded (see the activate cleanup, which skips
// it, and the fetch branch that fills it).
const FONT_CACHE = 'fonts'

// Precached on install: the URL-agnostic app shell, the manifest, and icons.
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) => k !== CACHE && k !== FONT_CACHE && k.startsWith('recipes-'),
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// Network-first with cache fallback: fresh when online, last-known when not.
async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(request)
    if (res && res.ok) cache.put(request, res.clone())
    return res
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw err
  }
}

// Cache-first: for content-hashed/immutable assets.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res && res.ok) cache.put(request, res.clone())
  return res
}

// Cache-first into the unversioned FONT_CACHE. Same as cacheFirst above but
// targets the deploy-surviving cache. On a miss we fetch and only store an ok
// response; if the network fails with nothing cached, the fetch rejects and the
// --serif CSS fallback (Georgia) takes over.
async function fontCacheFirst(request) {
  const cache = await caches.open(FONT_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res && res.ok) cache.put(request, res.clone())
  return res
}

// A first-time navigation (nothing cached yet for this exact URL) still waits
// on the network below, but only up to this long — past it we assume the
// network is the bottleneck, not correctness, and hand the tab to the local
// shell instead of leaving it blank.
const NAV_TIMEOUT_MS = 1200

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Navigations: stale-while-revalidate when we have something cached (this is
// the startup path — "/" is always precached, and start_url is "/" — so a slow
// network no longer blocks first paint on a fetch that hangs rather than
// fails). Serve the cached shell/page immediately and refresh it in the
// background via event.waitUntil so the tab doesn't get killed mid-fetch.
// Recipe *data* is never served from this cache — it's the store's
// IndexedDB → /api/recipes refresh (lib/store.tsx) that keeps content fresh,
// so a stale-for-one-load shell never means stale recipes.
//
// Nothing cached yet (first-ever visit, or a recipe never opened before) is
// the interesting case: the recipe itself is typically already in IndexedDB
// (the store's refresh caches the whole list, not just visited ones), so a
// plain network-first here would block on the round trip for content we
// already have. Race the fetch against NAV_TIMEOUT_MS; past it, fall back to
// the cached "/" shell (which renders this exact route from IndexedDB) while
// letting the fetch keep running in the background to populate the cache for
// next time. A fetch that fails outright (truly offline) resolves the race
// with null immediately, same as a timeout.
async function navigate(event) {
  const request = event.request
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) {
    event.waitUntil(
      fetch(request)
        .then((res) => {
          if (res && res.ok) return cache.put(request, res.clone())
        })
        .catch(() => {
          /* offline — keep serving the cached shell/page */
        }),
    )
    return cached
  }

  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => null)

  const winner = await Promise.race([network, delay(NAV_TIMEOUT_MS).then(() => null)])
  if (winner) return winner

  // network never rejects (see .catch(() => null) above) — waitUntil just
  // keeps the worker alive long enough for it to finish caching.
  event.waitUntil(network)
  const shell = await cache.match('/')
  if (shell) return shell
  const res = await network
  return res || Response.error()
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Never intercept writes — they must always reach the server.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // cross-origin: pass through

  if (request.mode === 'navigate') {
    event.respondWith(navigate(event))
    return
  }

  // Self-hosted font files (next/font → /_next/static/media/*.woff2). Served
  // cache-first from the unversioned FONT_CACHE so they persist across deploys.
  // Must precede the /_next/static/ branch below, which would otherwise route
  // them into the versioned cache that rotates on every redeploy.
  if (
    url.pathname.startsWith('/_next/static/media/') &&
    (url.pathname.endsWith('.woff2') || url.pathname.endsWith('.woff'))
  ) {
    event.respondWith(fontCacheFirst(request))
    return
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // GET /api/recipes and every other same-origin GET (incl. RSC payloads):
  // network-first with cache fallback. Network-first (not stale-while-
  // revalidate) so the app's refresh step never gets fed stale data.
  event.respondWith(networkFirst(request))
})
