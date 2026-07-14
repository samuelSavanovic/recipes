'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

// False during SSR and hydration, true once mounted on the client. Uses the
// server snapshot during hydration, so it never causes a mismatch — and, unlike
// a useState+useEffect mount flag, it doesn't trip react-hooks/set-state-in-effect.
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
