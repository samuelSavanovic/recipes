// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => '/edit/cacio-e-pepe',
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}))

import { RecipesProvider } from '@/lib/store'
import { EditView } from '@/components/EditView'
import { RecipeArticle } from '@/components/RecipeArticle'
import { idbReplaceAll } from '@/lib/idb'
import type { Recipe } from '@/lib/types'

const cacio: Recipe = {
  id: 'cacio-e-pepe',
  title: 'Cacio e pepe',
  cuisine: 'Italian',
  cook_time: '15_30',
  main: 'Pecorino Romano, Pepper',
  body_md: '## Ingredients\n\n- Pasta',
  created_at: 1,
  updated_at: 1,
}

function clearIdb(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('recipe-book')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  push.mockClear()
  await clearIdb()
  await idbReplaceAll([cacio])
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('main ingredients in the UI', () => {
  it('renders main in the recipe meta line', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))

    render(
      <RecipesProvider>
        <RecipeArticle recipe={cacio} />
      </RecipesProvider>,
    )

    expect(
      await screen.findByText('Pecorino Romano, Pepper'),
    ).toBeInTheDocument()
  })

  it('prefills the main input and sends the edited value in the save payload', async () => {
    const putBodies: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opts?: RequestInit) => {
        if (url.startsWith('/api/recipes/') && opts?.method === 'PUT') {
          const parsed = JSON.parse(opts.body as string)
          putBodies.push(parsed)
          return new Response(JSON.stringify({ ...cacio, main: parsed.main }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        // Background refresh
        return new Response(JSON.stringify([cacio]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    render(
      <RecipesProvider>
        <EditView slug="cacio-e-pepe" />
      </RecipesProvider>,
    )

    // The editor loads the recipe from the store and prefills the main input.
    const mainInput = (await screen.findByLabelText(
      'Main ingredients',
    )) as HTMLInputElement
    expect(mainInput.value).toBe('Pecorino Romano, Pepper')

    fireEvent.change(mainInput, { target: { value: 'Pecorino, Black Pepper' } })
    fireEvent.click(screen.getByText('Save recipe'))

    await waitFor(() => expect(putBodies.length).toBe(1))
    expect(putBodies[0].main).toBe('Pecorino, Black Pepper')
    // Navigates to the saved recipe afterward.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/recipe/cacio-e-pepe'))
  })
})
