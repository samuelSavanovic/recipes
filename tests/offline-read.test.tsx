// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// The App shell reads pathname from Next's router; stub it to the list route.
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

import { RecipesProvider } from '@/lib/store'
import App from '@/components/App'
import { idbReplaceAll } from '@/lib/idb'
import type { Recipe } from '@/lib/types'

const base = { main: '', body_md: '', created_at: 0, updated_at: 0 }
const seed: Recipe[] = [
  { ...base, id: 'cacio-e-pepe', title: 'Cacio e pepe', cuisine: 'Italian', cook_time: '15_30' },
  { ...base, id: 'focaccia', title: 'Focaccia', cuisine: 'Italian', cook_time: 'over_60' },
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
  await clearIdb()
  await idbReplaceAll(seed)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('offline read path', () => {
  it('renders seeded titles from IndexedDB when the network is down', async () => {
    // Network down: every fetch rejects.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))

    render(
      <RecipesProvider>
        <App />
      </RecipesProvider>,
    )

    // Titles come from the IndexedDB snapshot, not the network.
    expect(await screen.findByText('Cacio e pepe')).toBeInTheDocument()
    expect(await screen.findByText('Focaccia')).toBeInTheDocument()

    // The list rendered from cache — count reflects the two seeded recipes.
    expect(await screen.findByText(/2 recipes/)).toBeInTheDocument()
  })
})
