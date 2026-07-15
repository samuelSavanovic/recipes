'use client'

import { useSyncExternalStore } from 'react'
import { readTheme, subscribeTheme, writeTheme, type Theme } from './theme'

// The current theme *preference*, read via useSyncExternalStore so every
// consumer re-renders on change without a mount effect — same idiom as the edit
// token (lib/store.tsx) and useAppPath (lib/use-app-path.ts).
//
// The server snapshot is 'system' because that genuinely is the default when
// nothing is stored — not a placeholder. So SSR renders "auto" and, if a
// different preference is stored, useSyncExternalStore re-renders once after
// hydration. Only this button's label corrects; the page itself never flashes,
// because the bootstrap script already stamped <html> before first paint.
const serverSnapshot = (): Theme => 'system'

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverSnapshot)
  return [theme, writeTheme]
}
