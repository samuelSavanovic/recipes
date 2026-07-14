'use client'

import Link from 'next/link'
import { useState } from 'react'
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
      <Link href="/" className="rb-brand">
        <span className="rb-brand-mark">◍</span>
        <span className="rb-brand-name">mise</span>
        <span className="rb-brand-sub">recipe book</span>
      </Link>

      {hasToken ? (
        <Link href="/new" className="rb-btn rb-btn-primary">
          + New recipe
        </Link>
      ) : (
        <button className="rb-unlock" onClick={() => setShowUnlock(true)}>
          edit
        </button>
      )}

      {showUnlock && <UnlockDialog onClose={() => setShowUnlock(false)} />}
    </header>
  )
}
