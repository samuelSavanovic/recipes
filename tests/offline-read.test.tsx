// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// App derives its view from window.location; RecipeActions uses useRouter.
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

import { RecipesProvider } from '@/lib/store'
import App from '@/components/App'
import { idbReplaceAll } from '@/lib/idb'
import type { Recipe } from '@/lib/types'

const base = { created_at: 0, updated_at: 0 }
const seed: Recipe[] = [
  {
    ...base,
    id: 'cacio-e-pepe',
    title: 'Cacio e pepe',
    cuisine: 'Italian',
    cook_time: '15_30',
    main: 'Pecorino Romano, Pepper',
    body_md: '## Ingredients\n\n- Pasta\n- Pecorino',
  },
  {
    ...base,
    id: 'focaccia',
    title: 'Focaccia',
    cuisine: 'Italian',
    cook_time: 'over_60',
    main: 'Flour',
    body_md: '## Ingredients\n\n- Flour',
  },
]

function clearIdb(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('recipe-book')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  window.history.pushState(null, '', '/')
  await clearIdb()
  await idbReplaceAll(seed)
  // Network down for every offline test.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.history.pushState(null, '', '/')
})

describe('offline read path', () => {
  it('renders the list from IndexedDB when the network is down', async () => {
    render(
      <RecipesProvider>
        <App />
      </RecipesProvider>,
    )

    expect(await screen.findByText('Cacio e pepe')).toBeInTheDocument()
    expect(await screen.findByText('Focaccia')).toBeInTheDocument()
    expect(await screen.findByText(/2 recipes/)).toBeInTheDocument()
  })

  it('renders a /recipe/[slug] deep link from IndexedDB (offline shell fallback)', async () => {
    // Simulate the SW serving the "/" shell for a recipe URL: the document path
    // is the recipe, but there is no network.
    window.history.pushState(null, '', '/recipe/cacio-e-pepe')

    render(
      <RecipesProvider>
        <App />
      </RecipesProvider>,
    )

    // The recipe article (not the list) renders from the cached store.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cacio e pepe' }),
    ).toBeInTheDocument()
    expect(screen.getByText('← the book')).toBeInTheDocument()
    // Body markdown + main (rendered as separate badges) render too.
    expect(screen.getByText('Pecorino Romano')).toBeInTheDocument()
    expect(screen.getByText('Pepper')).toBeInTheDocument()
    expect(screen.getByText('Ingredients')).toBeInTheDocument()
  })
})
