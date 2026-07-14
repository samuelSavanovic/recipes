'use client'

import { useState } from 'react'
import { AppLink } from './AppLink'
import { useRecipes } from '@/lib/store'
import { UnlockDialog } from './UnlockDialog'

// Sticky top bar: brand → home, and an edit affordance on the right. With a
// token, the primary "+ New recipe" action; without one, a quiet "edit" link
// that opens the unlock dialog.
export function TopBar() {
  const { hasToken } = useRecipes()
  const [showUnlock, setShowUnlock] = useState(false)

  return (
    <header className="rb-topbar">
      <AppLink href="/" className="rb-brand">
        <span className="rb-brand-mark">◍</span>
        <span className="rb-brand-name">mise</span>
        <span className="rb-brand-sub">recipe book</span>
      </AppLink>

      {hasToken ? (
        <AppLink href="/new" className="rb-btn rb-btn-primary">
          + New recipe
        </AppLink>
      ) : (
        <button className="rb-unlock" onClick={() => setShowUnlock(true)}>
          edit
        </button>
      )}

      {showUnlock && <UnlockDialog onClose={() => setShowUnlock(false)} />}
    </header>
  )
}
