// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { useState } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

import { RecipesProvider } from '@/lib/store'
import { MainIngredientsInput } from './MainIngredientsInput'
import { idbReplaceAll } from '@/lib/idb'
import type { Recipe } from '@/lib/types'

const cacio: Recipe = {
  id: 'cacio-e-pepe',
  title: 'Cacio e pepe',
  cuisine: 'Italian',
  cook_time: '15_30',
  main: 'Pecorino Romano, Pepper, Gouda',
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
  return <MainIngredientsInput id="rb-main" value={value} onChange={setValue} />
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

describe('MainIngredientsInput', () => {
  it('suggests matching ingredients by prefix, ranked by usage', async () => {
    await idbReplaceAll([cacio])
    renderHarness()

    const input = await screen.findByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'gou' } })

    expect(await screen.findByRole('option', { name: 'Gouda' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Pepper' })).not.toBeInTheDocument()
  })

  it('commits a suggestion as a badge on Enter and clears the draft for the next entry', async () => {
    await idbReplaceAll([cacio])
    renderHarness()

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'gou' } })
    await screen.findByRole('option', { name: 'Gouda' })

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByText('Gouda')).toBeInTheDocument()
    await waitFor(() => expect(input.value).toBe(''))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('commits the highlighted match on Tab without moving focus off the field', async () => {
    await idbReplaceAll([cacio])
    renderHarness()

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'gou' } })
    await screen.findByRole('option', { name: 'Gouda' })

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    const prevented = !fireEvent(input, tab)

    expect(await screen.findByText('Gouda')).toBeInTheDocument()
    // Unlike CuisineInput's single-value Tab, this field IS multi-value and
    // must keep focus so the next ingredient can be typed right away.
    expect(prevented).toBe(true)
    await waitFor(() => expect(input.value).toBe(''))
  })

  it('accepts a novel ingredient not in the vocabulary as free text', async () => {
    await idbReplaceAll([cacio])
    renderHarness()

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Za\'atar' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByText("Za'atar")).toBeInTheDocument()
  })

  it('normalizes a lowercase free-text entry to Title Case on commit', async () => {
    await idbReplaceAll([])
    renderHarness()

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'olive oil' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByText('Olive Oil')).toBeInTheDocument()
    expect(screen.queryByText('olive oil')).not.toBeInTheDocument()
  })

  it('builds a comma-separated value string as badges are committed', async () => {
    await idbReplaceAll([])
    let latest = ''
    render(
      <RecipesProvider>
        <MainIngredientsInput id="rb-main" value="" onChange={(v) => (latest = v)} />
      </RecipesProvider>,
    )

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'garlic' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(latest).toBe('Garlic')
  })

  it('removes a badge when its × button is clicked', async () => {
    await idbReplaceAll([cacio])
    renderHarness(cacio.main)

    expect(await screen.findByText('Gouda')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Gouda' }))

    await waitFor(() => expect(screen.queryByText('Gouda')).not.toBeInTheDocument())
    expect(screen.getByText('Pecorino Romano')).toBeInTheDocument()
    expect(screen.getByText('Pepper')).toBeInTheDocument()
  })

  it('removes the last badge on Backspace when the draft is empty', async () => {
    await idbReplaceAll([cacio])
    renderHarness(cacio.main)

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    expect(await screen.findByText('Gouda')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Backspace' })

    await waitFor(() => expect(screen.queryByText('Gouda')).not.toBeInTheDocument())
    expect(screen.getByText('Pepper')).toBeInTheDocument()
  })

  it('does not touch badges on Backspace while the draft still has text', async () => {
    await idbReplaceAll([cacio])
    renderHarness(cacio.main)

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'x' } })
    fireEvent.keyDown(input, { key: 'Backspace' })

    expect(await screen.findByText('Gouda')).toBeInTheDocument()
  })

  it('commits a comma-terminated entry without inserting the comma', async () => {
    await idbReplaceAll([])
    renderHarness()

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'garlic' } })
    fireEvent.keyDown(input, { key: ',' })

    expect(await screen.findByText('Garlic')).toBeInTheDocument()
    await waitFor(() => expect(input.value).toBe(''))
  })

  it('deduplicates a repeated ingredient within the same row (case-insensitive)', async () => {
    await idbReplaceAll([cacio])
    renderHarness(cacio.main)

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'GOUDA' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(input.value).toBe(''))
    expect(screen.getAllByText(/^Gouda$/).length).toBe(1)
  })

  it('commits a leftover draft on blur so clicking Save does not drop it', async () => {
    await idbReplaceAll([])
    let latest = ''
    render(
      <RecipesProvider>
        <MainIngredientsInput id="rb-main" value="" onChange={(v) => (latest = v)} />
      </RecipesProvider>,
    )

    const input = (await screen.findByRole('combobox')) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'garlic' } })
    fireEvent.blur(input)

    await waitFor(() => expect(latest).toBe('Garlic'))
  })
})
