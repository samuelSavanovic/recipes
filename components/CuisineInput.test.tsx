// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { useState } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

import { RecipesProvider } from '@/lib/store'
import { CuisineInput } from './CuisineInput'
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

// Controlled wrapper so tests can drive value/onChange like the real editor does.
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <CuisineInput id="rb-cuisine" value={value} onChange={setValue} />
}

function renderHarness(initial?: string) {
  return render(
    <RecipesProvider>
      <Harness initial={initial} />
    </RecipesProvider>,
  )
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

describe('CuisineInput', () => {
  it('suggests matching cuisines by prefix and hides non-matches', async () => {
    await idbReplaceAll([cacio])
    renderHarness()

    const input = await screen.findByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'It' } })

    expect(await screen.findByRole('option', { name: 'Italian' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'French' })).not.toBeInTheDocument()
  })

  it('offers seed suggestions even with no recipes in the store', async () => {
    await idbReplaceAll([])
    renderHarness()

    const input = await screen.findByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Fr' } })

    expect(await screen.findByRole('option', { name: 'French' })).toBeInTheDocument()
  })

  it('fills the field and closes the list when a suggestion is clicked', async () => {
    await idbReplaceAll([cacio])
    renderHarness()

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'It' } })

    fireEvent.click(await screen.findByRole('option', { name: 'Italian' }))

    await waitFor(() => expect(input.value).toBe('Italian'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('commits the first match on Tab without blocking focus from moving on', async () => {
    await idbReplaceAll([cacio])
    renderHarness()

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'It' } })
    await screen.findByRole('option', { name: 'Italian' })

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    const prevented = !fireEvent(input, tab)

    await waitFor(() => expect(input.value).toBe('Italian'))
    // The handler must not preventDefault the Tab key, or focus would get stuck.
    expect(prevented).toBe(false)
  })

  it('biases suggestions toward cuisines already used, ahead of seed-only ones', async () => {
    await idbReplaceAll([cacio])
    renderHarness()

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'I' } })
    await screen.findByRole('option', { name: 'Italian' })

    // Italian (used once) must come before Indian (used zero times) even
    // though "Indian" sorts first alphabetically.
    //
    // waitFor, not a bare assertion: both names are in the COMMON_CUISINES seed,
    // so they render before the store's IDB read resolves. Until it does, every
    // usage count is 0 and the pool is still in plain alphabetical order — this
    // raced the load and failed intermittently when the suite ran under load.
    await waitFor(() =>
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Italian',
        'Indian',
      ]),
    )

    // ...and a plain Enter (no ArrowDown needed) commits the more-used match.
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(input.value).toBe('Italian'))
  })

  it('ranks a more-frequently-used cuisine above a less-used one', async () => {
    const curry: Recipe = {
      ...cacio,
      id: 'chana-masala',
      title: 'Chana masala',
      cuisine: 'Indian',
    }
    const dal: Recipe = { ...cacio, id: 'dal-tadka', title: 'Dal tadka', cuisine: 'Indian' }
    // Two Indian recipes outnumber the one Italian recipe (cacio).
    await idbReplaceAll([cacio, curry, dal])
    renderHarness()

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'I' } })
    await screen.findByRole('option', { name: 'Indian' })

    // Frequency wins over the old alphabetical-only order: Indian (2 recipes)
    // ranks above Italian (1 recipe).
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Indian', 'Italian'])

    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(input.value).toBe('Indian'))
  })

  it('commits the highlighted match on ArrowDown + Enter', async () => {
    await idbReplaceAll([cacio])
    renderHarness()

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'I' } })
    await screen.findByRole('option', { name: 'Italian' })

    // Italian is first (DB-biased); ArrowDown moves to the next option, Indian.
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(input.value).toBe('Indian'))
  })

  it('preserves a novel cuisine typed by hand', async () => {
    await idbReplaceAll([cacio])
    renderHarness()

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Ethiopian' } })
    fireEvent.blur(input)

    expect(input.value).toBe('Ethiopian')
  })
})
