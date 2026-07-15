'use client'

import { useMemo, useState, type KeyboardEvent } from 'react'
import { useRecipes } from '@/lib/store'
import { distinctCuisines } from '@/lib/filter'
import { COMMON_CUISINES } from '@/lib/types'

const MAX_SUGGESTIONS = 8

// Free-text cuisine input with type-ahead suggestions. Suggestions come from a
// curated seed list merged with cuisines already used in your recipes, so
// "type I -> Italian" works even before any Italian recipe exists. The field
// stays free text: nothing here rejects or rewrites an unmatched value.
export function CuisineInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const { recipes } = useRecipes()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const listId = `${id}-listbox`

  const pool = useMemo(() => {
    const merged = new Set([...COMMON_CUISINES, ...distinctCuisines(recipes)])
    return [...merged].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [recipes])

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    return pool
      .filter((c) => c.toLowerCase().startsWith(q) && c.toLowerCase() !== q)
      .slice(0, MAX_SUGGESTIONS)
  }, [pool, value])

  const showList = open && matches.length > 0

  function commit(match: string) {
    onChange(match)
    setOpen(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
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
      case 'Enter':
        e.preventDefault()
        commit(matches[activeIndex])
        break
      case 'Tab':
        // Don't preventDefault: fill the field but let focus move on as usual.
        commit(matches[activeIndex])
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }

  return (
    <div className="rb-combobox">
      <input
        id={id}
        className="rb-input"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setActiveIndex(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder="Italian"
      />
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
