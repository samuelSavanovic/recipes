'use client'

import { useMemo, useState } from 'react'
import { AppLink } from './AppLink'
import { useRecipes } from '@/lib/store'
import { distinctCuisines, filterRecipes } from '@/lib/filter'
import { COOK_TIMES, cookTimeLabel, type CookTime } from '@/lib/types'

// The book: search-by-title, cuisine + time-bucket filter chips, and the list of
// recipe rows. Fully public; renders from the local store (IDB-first).
export function ListView() {
  const { recipes, loading } = useRecipes()
  const [q, setQ] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [time, setTime] = useState<CookTime | ''>('')

  const cuisines = useMemo(() => distinctCuisines(recipes), [recipes])
  const filtered = useMemo(
    () => filterRecipes(recipes, { q, cuisine, time }),
    [recipes, q, cuisine, time],
  )

  return (
    <main className="rb-main">
      <div className="rb-list-head">
        <h1 className="rb-page-title">The book</h1>
        <p className="rb-page-sub">
          {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} —
          technique first, measured second.
        </p>
      </div>

      <div className="rb-filters">
        <input
          className="rb-search"
          placeholder="Search titles…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search titles"
        />
        <div className="rb-chiprow">
          <span className="rb-chiplabel">cuisine</span>
          <button
            className={`rb-chip ${!cuisine ? 'rb-chip-on' : ''}`}
            onClick={() => setCuisine('')}
          >
            all
          </button>
          {cuisines.map((c) => (
            <button
              key={c}
              className={`rb-chip ${cuisine === c ? 'rb-chip-on' : ''}`}
              onClick={() => setCuisine(cuisine === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="rb-chiprow">
          <span className="rb-chiplabel">time</span>
          <button
            className={`rb-chip ${!time ? 'rb-chip-on' : ''}`}
            onClick={() => setTime('')}
          >
            any
          </button>
          {COOK_TIMES.map((b) => (
            <button
              key={b.id}
              className={`rb-chip ${time === b.id ? 'rb-chip-on' : ''}`}
              onClick={() => setTime(time === b.id ? '' : b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? null : filtered.length === 0 ? (
        <div className="rb-empty">
          {recipes.length === 0
            ? 'No recipes yet. Unlock editing to write the first one.'
            : 'Nothing matches those filters. Clear them, or write a new recipe.'}
        </div>
      ) : (
        <ul className="rb-cards">
          {filtered.map((r) => (
            <li key={r.id}>
              <AppLink className="rb-card" href={`/recipe/${r.id}`}>
                <span className="rb-card-title">{r.title}</span>
                <span className="rb-card-meta">
                  <span className="rb-tag">{r.cuisine || '—'}</span>
                  <span className="rb-tag rb-tag-time">
                    {cookTimeLabel(r.cook_time)}
                  </span>
                </span>
              </AppLink>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
