'use client'

import { useEffect } from 'react'

// Registers the service worker. Production-only: in dev, cache-first handling of
// /_next/static/* would fight HMR and serve stale assets. Offline reads and the
// installability check are verified against `next build && next start`.
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failed — app still works online */
    })
  }, [])
  return null
}
