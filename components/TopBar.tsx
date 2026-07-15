'use client'

import { useState } from 'react'
import { AppLink } from './AppLink'
import { useRecipes } from '@/lib/store'
import { useTheme } from '@/lib/use-theme'
import { nextTheme, type Theme } from '@/lib/theme'
import { UnlockDialog } from './UnlockDialog'

// The label is the *preference*, not the resolved theme — so this never needs
// to know what the OS is doing (globals.css resolves 'auto' on its own).
const THEME_LABEL: Record<Theme, string> = {
  system: 'auto',
  light: 'light',
  dark: 'dark',
}

// Sticky top bar: brand → home, theme toggle + edit affordance on the right.
// With a token, the primary "+ New recipe" action; without one, a quiet "edit"
// link that opens the unlock dialog.
export function TopBar() {
  const { hasToken } = useRecipes()
  const [theme, setTheme] = useTheme()
  const [showUnlock, setShowUnlock] = useState(false)

  return (
    <header className="rb-topbar">
      <AppLink href="/" className="rb-brand">
        <span className="rb-brand-mark">◍</span>
        <span className="rb-brand-name">mise</span>
        <span className="rb-brand-sub">recipe book</span>
      </AppLink>

      <div className="rb-topbar-actions">
        <button
          className="rb-minibtn"
          onClick={() => setTheme(nextTheme(theme))}
          aria-label={`Theme: ${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[nextTheme(theme)]}.`}
        >
          {THEME_LABEL[theme]}
        </button>

        {hasToken ? (
          <AppLink href="/new" className="rb-btn rb-btn-primary">
            + New recipe
          </AppLink>
        ) : (
          <button className="rb-minibtn" onClick={() => setShowUnlock(true)}>
            edit
          </button>
        )}
      </div>

      {showUnlock && <UnlockDialog onClose={() => setShowUnlock(false)} />}
    </header>
  )
}
