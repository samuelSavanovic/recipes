'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Recipe, RecipeInput } from './types'
import { idbGetAll, idbPut, idbRemove, idbReplaceAll } from './idb'

// Local-first client store. On mount: read IndexedDB → render immediately; then,
// if online, fetch the API → replace IndexedDB → re-render ("eventually fresh").
// Writes are online-only and go straight to the API, then patch IndexedDB +
// state. Session token lives in localStorage; a 401 clears it so the UI relocks.

const TOKEN_KEY = 'recipe-edit-token'

type WriteResult =
  | { ok: true; recipe: Recipe }
  | { ok: false; status: number; fields?: Record<string, string> }

type DeleteResult = { ok: true } | { ok: false; status: number }

interface RecipesContextValue {
  recipes: Recipe[]
  loading: boolean
  hasToken: boolean
  getBySlug: (slug: string) => Recipe | undefined
  unlock: (password: string) => Promise<boolean>
  lock: () => void
  createRecipe: (input: RecipeInput) => Promise<WriteResult>
  updateRecipe: (slug: string, input: RecipeInput) => Promise<WriteResult>
  deleteRecipe: (slug: string) => Promise<DeleteResult>
}

const RecipesContext = createContext<RecipesContextValue | null>(null)

function sortByTitle(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  )
}

export function RecipesProvider({ children }: { children: ReactNode }) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)

  // Restore any saved edit token (client-only; keeps first render === SSR).
  useEffect(() => {
    try {
      setToken(localStorage.getItem(TOKEN_KEY))
    } catch {
      /* no localStorage — ignore */
    }
  }, [])

  // IDB-first read, then background refresh from the API.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const local = await idbGetAll()
        if (!cancelled && local.length) setRecipes(sortByTitle(local))
      } catch {
        /* no cache yet */
      } finally {
        if (!cancelled) setLoading(false)
      }

      try {
        const res = await fetch('/api/recipes')
        if (!res.ok) return
        const fresh: Recipe[] = await res.json()
        if (!cancelled) setRecipes(sortByTitle(fresh))
        await idbReplaceAll(fresh)
      } catch {
        /* offline — keep the IDB snapshot */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const authHeaders = useCallback((): Record<string, string> => {
    return token
      ? { 'content-type': 'application/json', Authorization: `Bearer ${token}` }
      : { 'content-type': 'application/json' }
  }, [token])

  const lock = useCallback(() => {
    setToken(null)
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) return false
      const { token: fresh } = (await res.json()) as { token: string }
      setToken(fresh)
      try {
        localStorage.setItem(TOKEN_KEY, fresh)
      } catch {
        /* ignore */
      }
      return true
    } catch {
      return false
    }
  }, [])

  const createRecipe = useCallback(
    async (input: RecipeInput): Promise<WriteResult> => {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(input),
      })
      if (res.status === 401) {
        lock()
        return { ok: false, status: 401 }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return { ok: false, status: res.status, fields: body.fields }
      }
      const recipe: Recipe = await res.json()
      await idbPut(recipe).catch(() => {})
      setRecipes((prev) =>
        sortByTitle([...prev.filter((r) => r.id !== recipe.id), recipe]),
      )
      return { ok: true, recipe }
    },
    [authHeaders, lock],
  )

  const updateRecipe = useCallback(
    async (slug: string, input: RecipeInput): Promise<WriteResult> => {
      const res = await fetch(`/api/recipes/${slug}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(input),
      })
      if (res.status === 401) {
        lock()
        return { ok: false, status: 401 }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return { ok: false, status: res.status, fields: body.fields }
      }
      const recipe: Recipe = await res.json()
      await idbPut(recipe).catch(() => {})
      setRecipes((prev) =>
        sortByTitle([...prev.filter((r) => r.id !== recipe.id), recipe]),
      )
      return { ok: true, recipe }
    },
    [authHeaders, lock],
  )

  const deleteRecipe = useCallback(
    async (slug: string): Promise<DeleteResult> => {
      const res = await fetch(`/api/recipes/${slug}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.status === 401) {
        lock()
        return { ok: false, status: 401 }
      }
      if (!res.ok) return { ok: false, status: res.status }
      await idbRemove(slug).catch(() => {})
      setRecipes((prev) => prev.filter((r) => r.id !== slug))
      return { ok: true }
    },
    [authHeaders, lock],
  )

  const getBySlug = useCallback(
    (slug: string) => recipes.find((r) => r.id === slug),
    [recipes],
  )

  const value: RecipesContextValue = {
    recipes,
    loading,
    hasToken: token !== null,
    getBySlug,
    unlock,
    lock,
    createRecipe,
    updateRecipe,
    deleteRecipe,
  }

  return (
    <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>
  )
}

export function useRecipes(): RecipesContextValue {
  const ctx = useContext(RecipesContext)
  if (!ctx) throw new Error('useRecipes must be used within a RecipesProvider')
  return ctx
}
