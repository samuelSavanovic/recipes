'use client'

import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void): () => void {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

// The true current path, read from window.location — authoritative offline,
// where the service worker may serve the cached "/" shell for a "/recipe/x" URL.
// usePathname() would return the shell's baked-in "/" there; window.location has
// the real URL. Returns null on the server and during hydration (callers render
// nothing until mounted, which also keeps hydration consistent). Reactive to
// back/forward via popstate.
export function useAppPath(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => null,
  )
}
