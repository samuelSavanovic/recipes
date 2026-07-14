'use client'

import { useState } from 'react'
import { useRecipes } from '@/lib/store'

// Small modal for entering the shared edit password. On success the token is
// stored by the store and the UI unlocks. Hiding edit UI is only UX — the
// server still verifies the token on every write.
export function UnlockDialog({
  onClose,
  onUnlocked,
}: {
  onClose: () => void
  onUnlocked?: () => void
}) {
  const { unlock } = useRecipes()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setError('')
    const ok = await unlock(password)
    setBusy(false)
    if (ok) {
      onUnlocked?.()
      onClose()
    } else {
      setError('Incorrect password.')
    }
  }

  return (
    <div className="rb-modal-overlay" onClick={onClose}>
      <div
        className="rb-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Unlock editing"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <h2 className="rb-modal-title">Unlock editing</h2>
          <input
            className="rb-input"
            style={{ width: '100%' }}
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Edit password"
            aria-label="Edit password"
          />
          {error && <div className="rb-error">{error}</div>}
          <div className="rb-modal-actions">
            <button type="button" className="rb-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="rb-btn rb-btn-primary"
              disabled={busy || password.length === 0}
            >
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
