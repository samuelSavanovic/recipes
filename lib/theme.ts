// Theme preference: external mutable state (localStorage + an attribute on
// <html>), mirroring the edit-token store in lib/store.tsx. The hook lives in
// lib/use-theme.ts — this module stays React-free on purpose, because
// app/layout.tsx is a Server Component and needs THEME_KEY for the bootstrap
// script. Importing a hook here would pull useSyncExternalStore into the server
// graph, which React's "react-server" export condition does not provide.
//
// The stored value is always the *preference*, never the resolved theme:
// 'system' must stay 'system' so the CSS @media query keeps tracking live OS
// changes. globals.css resolves it; nothing here needs matchMedia.

export const THEME_KEY = 'recipe-theme'

// Order is the toggle's cycle order — see nextTheme.
export const THEMES = ['system', 'light', 'dark'] as const

export type Theme = (typeof THEMES)[number]

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme)
}

// Browser-chrome tint for app/layout.tsx's viewport export. Duplicates --paper
// from globals.css because <meta> can't read a CSS custom property — so
// lib/theme.test.ts asserts the two never drift apart.
export const THEME_COLOR: Record<'light' | 'dark', string> = {
  light: '#efe9dd',
  dark: '#16130f',
}

export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
}

export function readTheme(): Theme {
  try {
    const stored: unknown = localStorage.getItem(THEME_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    return 'system' // no localStorage — fall back to following the OS
  }
}

// 'system' is represented by the *absence* of the attribute, so that
// :root:not([data-theme='light']) matches under the dark media query. Must stay
// in step with THEME_BOOTSTRAP_SCRIPT below.
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
}

const themeListeners = new Set<() => void>()

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* no localStorage — the choice just won't survive a reload */
  }
  applyTheme(theme)
  for (const listener of themeListeners) listener()
}

export function subscribeTheme(callback: () => void): () => void {
  themeListeners.add(callback)

  // Cross-tab sync. Unlike the token's listener in lib/store.tsx, this one has
  // to re-apply the attribute as well as re-render: the other tab wrote
  // localStorage, but <html> in *this* document is still on the old theme.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_KEY) return
    applyTheme(readTheme())
    callback()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }
  return () => {
    themeListeners.delete(callback)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  }
}

// Runs blocking in <head>, before first paint, to stamp the stored preference
// onto <html> — without it every load flashes light before hydration. Kept to
// one line of dependency-free ES5 with no interpolation; see app/layout.tsx.
export const THEME_BOOTSTRAP_SCRIPT =
  `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});` +
  `if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`
