'use client'

import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useRecipes } from '@/lib/store'
import {
  normalizeIngredient,
  parseMainIngredients,
  serializeMainIngredients,
} from '@/lib/mainIngredients'

const MAX_SUGGESTIONS = 8

// Free-text, multi-value autocomplete for `main` (main ingredients). Same
// combobox pattern as CuisineInput, but commits one badge at a time instead
// of replacing the whole field: Tab/Enter/comma turns the current draft into
// a badge and keeps focus in the field so the next ingredient can be typed
// right away. Unlike cuisine there's no seed list — the vocabulary is only
// what's already used across recipes, ranked by how often each token
// appears. Values are normalized on commit (see normalizeIngredient) so
// sloppy free typing converges toward the canonical casing already in use;
// this is safe to run on autocomplete picks too since it no-ops on anything
// already correctly cased.
export function MainIngredientsInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const { recipes } = useRecipes()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const listId = `${id}-listbox`

  const badges = useMemo(() => parseMainIngredients(value), [value])

  const pool = useMemo(() => {
    const seen = new Map<string, { display: string; count: number }>()
    for (const r of recipes) {
      for (const ing of parseMainIngredients(r.main)) {
        const key = ing.toLowerCase()
        const entry = seen.get(key)
        if (entry) entry.count += 1
        else seen.set(key, { display: ing, count: 1 })
      }
    }
    return [...seen.values()]
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count // more-used ingredients first
        return a.display.localeCompare(b.display, undefined, { sensitivity: 'base' })
      })
      .map((entry) => entry.display)
  }, [recipes])

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    if (!q) return []
    const used = new Set(badges.map((b) => b.toLowerCase()))
    return pool
      .filter((ing) => {
        const k = ing.toLowerCase()
        return k.startsWith(q) && k !== q && !used.has(k)
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [pool, draft, badges])

  const showList = open && matches.length > 0

  function commit(raw: string) {
    setDraft('')
    setOpen(false)
    setActiveIndex(0)
    const normalized = normalizeIngredient(raw)
    if (!normalized) return
    if (badges.some((b) => b.toLowerCase() === normalized.toLowerCase())) return
    onChange(serializeMainIngredients([...badges, normalized]))
  }

  function removeBadge(index: number) {
    onChange(serializeMainIngredients(badges.filter((_, i) => i !== index)))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && draft === '' && badges.length > 0) {
      removeBadge(badges.length - 1)
      return
    }
    if (e.key === ',') {
      // Commas are the delimiter, not part of an ingredient — never let one
      // land in the draft text.
      e.preventDefault()
      if (draft.trim()) commit(showList ? matches[activeIndex] : draft)
      return
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && draft.trim()) {
      // Unlike CuisineInput, do preventDefault on Tab: this field is
      // multi-value, so Tab should commit the badge and stay put for the
      // next ingredient rather than move focus on.
      e.preventDefault()
      commit(showList ? matches[activeIndex] : draft)
      return
    }
    if (!showList) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % matches.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length)
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }

  return (
    <div className="rb-combobox">
      <div
        className="rb-badges"
        onMouseDown={(e) => {
          // Clicking empty space in the field should focus the input, same
          // as clicking any other text input.
          if (e.target === e.currentTarget) {
            e.preventDefault()
            inputRef.current?.focus()
          }
        }}
      >
        {badges.map((b, i) => (
          <span key={`${b.toLowerCase()}-${i}`} className="rb-badge">
            <span className="rb-badge-label">{b}</span>
            <button
              type="button"
              className="rb-badge-remove"
              aria-label={`Remove ${b}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => removeBadge(i)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          className="rb-badge-text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Commit whatever's left in the draft so clicking straight to
            // Save doesn't silently drop the last typed ingredient.
            setOpen(false)
            if (draft.trim()) commit(draft)
          }}
          onKeyDown={handleKeyDown}
          placeholder={badges.length === 0 ? 'Olive Oil, Garlic' : ''}
        />
      </div>
      {showList && (
        <ul className="rb-combo-list" role="listbox" id={listId}>
          {matches.map((m, i) => (
            <li
              key={m}
              role="option"
              aria-selected={i === activeIndex}
              className={`rb-combo-opt ${i === activeIndex ? 'rb-combo-opt-on' : ''}`}
              // Fire before the input's blur handler so the click still lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(m)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
