'use client'

import { useEffect } from 'react'

// Registers the service worker in production. In dev it does the opposite —
// unregisters any stray SW (and drops its caches), because a leftover SW from a
// local `next build && next start` keeps controlling localhost and serves
// /_next/static/* cache-first, which fights HMR and loops the page on reload.
// Offline reads and the installability check are verified against
// `next build && next start`.
export function RegisterSW() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // Dev guard: a SW left over from a local `next start` (same localhost:port)
    // keeps controlling the origin and serves /_next/static/* cache-first,
    // starving HMR and looping the page on full reloads. Actively evict any
    // stray registration + its caches so the boundary is a wall, not a note.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch(() => {})
      if (typeof caches !== 'undefined') {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {})
      }
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failed — app still works online */
    })
  }, [])
  return null
}
