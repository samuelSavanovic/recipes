'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useRecipes } from '@/lib/store'
import { COOK_TIMES, type CookTime, type Recipe } from '@/lib/types'
import { CuisineInput } from './CuisineInput'
import { MainIngredientsInput } from './MainIngredientsInput'
import { RecipeMarkdown } from './RecipeMarkdown'

// Which view the body field is showing. Preview renders through the same
// RecipeMarkdown the recipe page uses, so what you see here is what ships.
const BODY_TABS = [
  { id: 'write', label: 'Write' },
  { id: 'preview', label: 'Preview' },
] as const
type BodyTab = (typeof BODY_TABS)[number]['id']

// Editor for new + existing recipes. Writes are online-only and go through the
// store (which patches IndexedDB + state on success). The slug is server-owned
// and never sent. Rendered only behind the edit gate (see components/App).
export function EditView({ slug }: { slug?: string }) {
  const { getBySlug, loading } = useRecipes()

  if (slug) {
    const existing = getBySlug(slug)
    if (!existing) {
      return (
        <main className="rb-main">
          <div className="rb-empty">
            {loading ? 'Loading…' : 'That recipe no longer exists.'}
          </div>
        </main>
      )
    }
    // key resets form state if the target recipe changes.
    return <EditForm key={existing.id} recipe={existing} />
  }

  return <EditForm key="new" recipe={null} />
}

function EditForm({ recipe }: { recipe: Recipe | null }) {
  const { createRecipe, updateRecipe, deleteRecipe } = useRecipes()
  const router = useRouter()

  const [title, setTitle] = useState(recipe?.title ?? '')
  const [cuisine, setCuisine] = useState(recipe?.cuisine ?? '')
  const [main, setMain] = useState(recipe?.main ?? '')
  const [cookTime, setCookTime] = useState<CookTime>(recipe?.cook_time ?? '15_30')
  const [body, setBody] = useState(recipe?.body_md ?? '')
  const [bodyTab, setBodyTab] = useState<BodyTab>('write')
  const [error, setError] = useState('')
  // Which write is in flight, if any — drives the per-button loading indicator.
  const [pending, setPending] = useState<'save' | 'delete' | null>(null)
  const busy = pending !== null
  const tablistRef = useRef<HTMLDivElement>(null)

  const canSave = title.trim().length > 0 && !busy

  // Arrow/Home/End move between tabs (WAI-ARIA tabs pattern). Selection follows
  // focus, so the panel switches as you arrow — cheap here, both panels are local
  // state. Roving tabindex keeps the group a single Tab stop.
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = BODY_TABS.findIndex((t) => t.id === bodyTab)
    const last = BODY_TABS.length - 1
    let next: number
    if (e.key === 'ArrowRight') next = i === last ? 0 : i + 1
    else if (e.key === 'ArrowLeft') next = i === 0 ? last : i - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    else return
    e.preventDefault()
    const id = BODY_TABS[next].id
    setBodyTab(id)
    tablistRef.current
      ?.querySelector<HTMLButtonElement>(`#rb-body-tab-${id}`)
      ?.focus()
  }

  function cancel() {
    router.push(recipe ? `/recipe/${recipe.id}` : '/')
  }

  async function save() {
    if (!canSave) return
    setPending('save')
    setError('')
    const input = {
      title: title.trim(),
      cuisine: cuisine.trim(),
      cook_time: cookTime,
      main: main.trim(),
      body_md: body,
    }
    const res = recipe
      ? await updateRecipe(recipe.id, input)
      : await createRecipe(input)

    if (res.ok) {
      router.push(`/recipe/${res.recipe.id}`) // keep spinner until navigation
    } else if (res.status === 401) {
      router.push('/') // session expired — relocked
    } else {
      setPending(null)
      const detail = res.fields ? Object.values(res.fields).join(' ') : ''
      setError(`Could not save. ${detail}`.trim())
    }
  }

  async function remove() {
    if (!recipe) return
    if (!window.confirm(`Delete “${recipe.title}”? This cannot be undone.`)) return
    setPending('delete')
    setError('')
    const res = await deleteRecipe(recipe.id)
    if (res.ok || res.status === 401) {
      router.push('/') // keep spinner until navigation
    } else {
      setPending(null)
      setError('Could not delete.')
    }
  }

  return (
    <main className="rb-main rb-edit">
      <div className="rb-recipe-nav">
        <button className="rb-link" onClick={cancel}>
          ← cancel
        </button>
        {recipe && (
          <button className="rb-btn rb-btn-danger" onClick={remove} disabled={busy}>
            {pending === 'delete' ? (
              <>
                <span className="rb-spinner" aria-hidden="true" />
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </button>
        )}
      </div>

      <div className="rb-field">
        <label className="rb-label" htmlFor="rb-title">
          Title
        </label>
        <input
          id="rb-title"
          className="rb-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Focaccia Dipping Oil"
        />
      </div>

      <div className="rb-field-row">
        <div className="rb-field">
          <label className="rb-label" htmlFor="rb-cuisine">
            Cuisine
          </label>
          <CuisineInput id="rb-cuisine" value={cuisine} onChange={setCuisine} />
        </div>
        <div className="rb-field">
          <label className="rb-label" htmlFor="rb-main">
            Main ingredients
          </label>
          <MainIngredientsInput id="rb-main" value={main} onChange={setMain} />
        </div>
      </div>

      <div className="rb-field">
        <label className="rb-label">Time</label>
        <div className="rb-seg" role="group" aria-label="Cook time">
          {COOK_TIMES.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`rb-seg-btn ${cookTime === b.id ? 'rb-seg-on' : ''}`}
              aria-pressed={cookTime === b.id}
              onClick={() => setCookTime(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rb-field">
        <div className="rb-label-row">
          <label className="rb-label" htmlFor="rb-body">
            Recipe <span className="rb-label-hint">— plain markdown</span>
          </label>
          <div
            className="rb-seg rb-seg-sm"
            role="tablist"
            aria-label="Recipe body view"
            ref={tablistRef}
          >
            {BODY_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`rb-body-tab-${t.id}`}
                className={`rb-seg-btn ${bodyTab === t.id ? 'rb-seg-on' : ''}`}
                aria-selected={bodyTab === t.id}
                aria-controls={`rb-body-panel-${t.id}`}
                tabIndex={bodyTab === t.id ? 0 : -1}
                onClick={() => setBodyTab(t.id)}
                onKeyDown={onTabKeyDown}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hidden, not unmounted: body text lives in state, but the caret and
            scroll position live in the DOM and would reset on every trip back
            from Preview. */}
        <div
          id="rb-body-panel-write"
          className="rb-body-panel"
          role="tabpanel"
          aria-labelledby="rb-body-tab-write"
          hidden={bodyTab !== 'write'}
        >
          <textarea
            id="rb-body"
            className="rb-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'## Ingredients\n\n- …'}
            spellCheck={false}
          />
        </div>

        {/* The panel stays mounted so aria-controls always resolves; the markdown
            only renders while visible, so typing doesn't re-parse the body. */}
        <div
          id="rb-body-panel-preview"
          className="rb-body-panel rb-preview"
          role="tabpanel"
          aria-labelledby="rb-body-tab-preview"
          hidden={bodyTab !== 'preview'}
          tabIndex={0}
        >
          {bodyTab === 'preview' &&
            (body.trim() ? (
              <RecipeMarkdown source={body} />
            ) : (
              <p className="rb-preview-empty">Nothing to preview yet.</p>
            ))}
        </div>
      </div>

      {error && <div className="rb-error">{error}</div>}

      <div className="rb-edit-actions">
        <button className="rb-btn" onClick={cancel} disabled={busy}>
          Cancel
        </button>
        <button
          className="rb-btn rb-btn-primary"
          onClick={save}
          disabled={!canSave}
        >
          {pending === 'save' ? (
            <>
              <span className="rb-spinner" aria-hidden="true" />
              Saving…
            </>
          ) : (
            'Save recipe'
          )}
        </button>
      </div>
    </main>
  )
}
