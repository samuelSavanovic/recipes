'use client'

import { useMemo, useState } from 'react'
import { AppLink } from './AppLink'
import { useRecipes } from '@/lib/store'
import { distinctCuisines, filterRecipes } from '@/lib/filter'
import { COOK_TIMES, cookTimeLabel, type CookTime } from '@/lib/types'

// The book: search over titles + main ingredients, cuisine + time-bucket filter
// chips, and the list of recipe rows. Fully public; renders from the local store
// (IDB-first).
//
// While a search is active the page header collapses, and a chip row is rendered
// only when that dimension has a filter actually applied. On a phone with the
// keyboard up there are only ~350px of visible page, and the header plus two
// chip rows ate almost all of it — you could not see the list narrow as you
// typed. "all"/"any" are the *absence* of a filter, so they're not worth a row:
// below 560px the label takes its own line (see .rb-chiplabel), making each row
// ~90px to say nothing. An applied filter does earn its row, so it stays visible
// rather than silently narrowing your results from off-screen.
export function ListView() {
  const { recipes, loading } = useRecipes()
  const [q, setQ] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [time, setTime] = useState<CookTime | ''>('')

  const searching = q.trim() !== ''
  const cuisines = useMemo(() => distinctCuisines(recipes), [recipes])
  const filtered = useMemo(
    () => filterRecipes(recipes, { q, cuisine, time }),
    [recipes, q, cuisine, time],
  )

  return (
    <main className="rb-main">
      {searching ? null : (
        <div className="rb-list-head">
          <h1 className="rb-page-title">The book</h1>
          <p className="rb-page-sub">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} —
            technique first, measured second.
          </p>
        </div>
      )}

      <div className={`rb-filters ${searching ? 'rb-filters-searching' : ''}`}>
        <div className="rb-searchrow">
          <input
            className="rb-search"
            placeholder="Search recipes and ingredients…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search recipes and ingredients"
            // Filtering is live, so there is nothing to submit — the only job of
            // the phone keyboard's Go key is to get out of the way. Blur does
            // that; the query and results stay put.
            enterKeyHint="search"
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
          {/* Live count: the keyboard can still cover the list on a short
              screen, so give an unambiguous signal that typing did something. */}
          <span className="rb-searchcount" role="status" aria-live="polite">
            {searching ? `${filtered.length} of ${recipes.length}` : ''}
          </span>
        </div>
        {searching && cuisine === '' ? null : (
          <div className="rb-chiprow">
            <span className="rb-chiplabel">cuisine</span>
            {searching ? null : (
              <button
                className={`rb-chip ${!cuisine ? 'rb-chip-on' : ''}`}
                onClick={() => setCuisine('')}
              >
                all
              </button>
            )}
            {cuisines
              .filter((c) => !searching || cuisine === c)
              .map((c) => (
                <button
                  key={c}
                  className={`rb-chip ${cuisine === c ? 'rb-chip-on' : ''}`}
                  onClick={() => setCuisine(cuisine === c ? '' : c)}
                >
                  {c}
                </button>
              ))}
          </div>
        )}
        {searching && time === '' ? null : (
          <div className="rb-chiprow">
            <span className="rb-chiplabel">time</span>
            {searching ? null : (
              <button
                className={`rb-chip ${!time ? 'rb-chip-on' : ''}`}
                onClick={() => setTime('')}
              >
                any
              </button>
            )}
            {COOK_TIMES.filter((b) => !searching || time === b.id).map((b) => (
              <button
                key={b.id}
                className={`rb-chip ${time === b.id ? 'rb-chip-on' : ''}`}
                onClick={() => setTime(time === b.id ? '' : b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
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
