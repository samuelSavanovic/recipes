// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'

import { RecipesProvider } from '@/lib/store'
import { ListView } from './ListView'
import { idbReplaceAll } from '@/lib/idb'
import type { Recipe } from '@/lib/types'

const base = { body_md: '', created_at: 0, updated_at: 0 }
const seed: Recipe[] = [
  // Adobo is an ingredient-only match for "chicken" that sorts before the title
  // match alphabetically, so the ranking assertion below can't pass by accident.
  {
    ...base,
    id: 'adobo',
    title: 'Adobo',
    cuisine: 'Filipino',
    cook_time: '30_60',
    main: 'Chicken, Soy Sauce',
  },
  {
    ...base,
    id: 'carbonara',
    title: 'Carbonara',
    cuisine: 'Italian',
    cook_time: '15_30',
    main: 'Guanciale, Egg, Pecorino Romano',
  },
  {
    ...base,
    id: 'katsu',
    title: 'Katsu Curry',
    cuisine: 'Japanese',
    cook_time: '30_60',
    main: 'Chicken, Panko',
  },
  {
    ...base,
    id: 'chicken-stock',
    title: 'Chicken Stock',
    cuisine: 'General',
    cook_time: 'over_60',
    main: 'Chicken Wings, Onion',
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

async function renderList() {
  await idbReplaceAll(seed)
  render(
    <RecipesProvider>
      <ListView />
    </RecipesProvider>,
  )
  // The input renders before the IDB read resolves, so wait on a card instead —
  // otherwise assertions race an empty list.
  await screen.findByRole('link', { name: /Carbonara/ })
  return screen.getByLabelText('Search recipes and ingredients') as HTMLInputElement
}

// The rendered card titles, in order. Reads the title element directly rather
// than the whole link, whose text also carries the cuisine and time tags.
function cardTitles(): string[] {
  return screen
    .queryAllByRole('listitem')
    .map((li) => li.querySelector('.rb-card-title')?.textContent ?? '')
}

// The chip row for a dimension, or null when the row isn't rendered at all.
function chipRow(label: string): HTMLElement | null {
  return screen.queryByText(label)?.parentElement ?? null
}

function chipLabels(label: string): string[] | null {
  const row = chipRow(label)
  if (!row) return null
  return within(row)
    .getAllByRole('button')
    .map((b) => b.textContent ?? '')
}

beforeEach(async () => {
  await clearIdb()
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ListView search', () => {
  it('narrows the list to ingredient matches as you type', async () => {
    const input = await renderList()
    expect(cardTitles()).toEqual(['Adobo', 'Carbonara', 'Chicken Stock', 'Katsu Curry'])

    fireEvent.change(input, { target: { value: 'panko' } })

    expect(cardTitles()).toEqual(['Katsu Curry'])
  })

  it('ranks a title match above an ingredient-only match', async () => {
    const input = await renderList()
    fireEvent.change(input, { target: { value: 'chicken' } })

    // Adobo would lead alphabetically; Chicken Stock leads on its title match.
    expect(cardTitles()).toEqual(['Chicken Stock', 'Adobo', 'Katsu Curry'])
  })

  it('reports the live match count while searching, and nothing when idle', async () => {
    const input = await renderList()
    expect(screen.getByRole('status')).toHaveTextContent('')

    fireEvent.change(input, { target: { value: 'chicken' } })

    expect(screen.getByRole('status')).toHaveTextContent('3 of 4')
  })

  it('drops an unfiltered chip row entirely while searching, and restores it when cleared', async () => {
    const input = await renderList()
    expect(chipLabels('cuisine')).toEqual([
      'all',
      'Filipino',
      'General',
      'Italian',
      'Japanese',
    ])

    fireEvent.change(input, { target: { value: 'chicken' } })

    // No filter is applied, so the whole row goes — label included. Leaving an
    // "all" chip behind would cost a ~90px row to say "nothing is filtered".
    expect(chipRow('cuisine')).toBeNull()
    expect(chipRow('time')).toBeNull()

    fireEvent.change(input, { target: { value: '' } })

    expect(chipLabels('cuisine')).toEqual([
      'all',
      'Filipino',
      'General',
      'Italian',
      'Japanese',
    ])
  })

  it('keeps an applied filter visible while searching inside it', async () => {
    const input = await renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Japanese' }))
    fireEvent.change(input, { target: { value: 'chicken' } })

    // The applied cuisine earns its row; "all" and the unselected chips go, and
    // the unfiltered time row goes with them.
    expect(chipLabels('cuisine')).toEqual(['Japanese'])
    expect(chipRow('time')).toBeNull()
    expect(cardTitles()).toEqual(['Katsu Curry'])
  })

  it('can clear an applied filter without first clearing the search', async () => {
    const input = await renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Japanese' }))
    fireEvent.change(input, { target: { value: 'chicken' } })
    expect(cardTitles()).toEqual(['Katsu Curry'])

    // The surviving chip is still a live toggle, not just a readout.
    fireEvent.click(screen.getByRole('button', { name: 'Japanese' }))

    expect(chipRow('cuisine')).toBeNull()
    expect(cardTitles()).toEqual(['Chicken Stock', 'Adobo', 'Katsu Curry'])
  })

  it('dismisses the keyboard on Enter without disturbing the results', async () => {
    const input = await renderList()
    input.focus()
    fireEvent.change(input, { target: { value: 'chicken' } })
    expect(document.activeElement).toBe(input)

    fireEvent.keyDown(input, { key: 'Enter' })

    // Blurring is what drops the phone's keyboard; the query must survive it.
    expect(document.activeElement).not.toBe(input)
    expect(input.value).toBe('chicken')
    expect(cardTitles()).toEqual(['Chicken Stock', 'Adobo', 'Katsu Curry'])
  })

  it('leaves other keys alone', async () => {
    const input = await renderList()
    input.focus()
    fireEvent.change(input, { target: { value: 'chicken' } })

    fireEvent.keyDown(input, { key: 'a' })

    expect(document.activeElement).toBe(input)
  })

  it('hides the page header while searching to make room for results', async () => {
    const input = await renderList()
    expect(screen.getByRole('heading', { name: 'The book' })).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'chicken' } })

    expect(screen.queryByRole('heading', { name: 'The book' })).not.toBeInTheDocument()
  })
})
