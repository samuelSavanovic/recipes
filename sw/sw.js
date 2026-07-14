// Hand-written service worker (no workbox/serwist) for full visibility into the
// caching strategy — the fiddliest surface. VERSION is stamped at build time by
// scripts/stamp-sw.mjs so every deploy ships a byte-different SW that reinstalls
// and purges old caches. IndexedDB (not this cache) is the real offline read
// store; the SW makes the app shell + last-seen pages openable offline.

const VERSION = '__SW_VERSION__'
const CACHE = `recipes-${VERSION}`

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
            .filter((k) => k.startsWith('recipes-') && k !== CACHE)
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

// Navigations: network-first (so online users always get fresh HTML — this is
// what avoids the classic stale-shell-after-deploy). Offline, serve the exact
// URL if we've cached it (a previously-visited recipe returns its full SSR
// HTML), else fall back to the "/" shell, which renders the route from
// IndexedDB after mount.
async function navigate(request) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(request)
    if (res && res.ok) cache.put(request, res.clone())
    return res
  } catch {
    const exact = await cache.match(request)
    if (exact) return exact
    const shell = await cache.match('/')
    if (shell) return shell
    return Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Never intercept writes — they must always reach the server.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // cross-origin: pass through

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request))
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
