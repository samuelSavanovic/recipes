// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// The editor pushes on save/cancel; nothing here exercises navigation, but the
// mock keeps the tree self-contained (same shape as TopBar.test.tsx).
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

import { RecipesProvider } from '@/lib/store'
import { EditView } from './EditView'

afterEach(() => cleanup())

// Renders the new-recipe form (no slug), so no store seeding is needed.
function renderEditor() {
  const utils = render(
    <RecipesProvider>
      <EditView />
    </RecipesProvider>,
  )
  return {
    ...utils,
    body: screen.getByLabelText(/plain markdown/) as HTMLTextAreaElement,
    writeTab: screen.getByRole('tab', { name: 'Write' }),
    previewTab: screen.getByRole('tab', { name: 'Preview' }),
  }
}

describe('EditView — body preview tab', () => {
  it('renders the typed markdown through the recipe renderer', () => {
    const { container, body, previewTab } = renderEditor()

    // A heading (which RecipeMarkdown shifts down a level) plus the signature
    // table, so a naive renderer swapped in here would fail this.
    fireEvent.change(body, {
      target: {
        value: ['## Sauce', '', '| A | B |', '| --- | --- |', '| 1 | 2 |'].join(
          '\n',
        ),
      },
    })
    fireEvent.click(previewTab)

    const panel = container.querySelector('#rb-body-panel-preview')!
    expect(panel).not.toHaveAttribute('hidden')

    const heading = panel.querySelector('h3.rb-h.rb-h2')
    expect(heading?.textContent).toBe('Sauce')

    const cells = Array.from(
      panel.querySelectorAll('.rb-table-wrap > table.rb-table tbody td'),
    ).map((td) => td.textContent)
    expect(cells).toEqual(['1', '2'])
  })

  it('previews edits made after the last preview, not a stale snapshot', () => {
    const { container, body, writeTab, previewTab } = renderEditor()

    fireEvent.change(body, { target: { value: 'first' } })
    fireEvent.click(previewTab)
    const panel = container.querySelector('#rb-body-panel-preview')!
    expect(panel.querySelector('p.rb-p')?.textContent).toBe('first')

    fireEvent.click(writeTab)
    fireEvent.change(body, { target: { value: 'second' } })
    fireEvent.click(previewTab)
    expect(panel.querySelector('p.rb-p')?.textContent).toBe('second')
  })

  it('shows the placeholder, and no rendered body, for a whitespace-only draft', () => {
    const { container, body, previewTab } = renderEditor()

    fireEvent.change(body, { target: { value: '   \n  ' } })
    fireEvent.click(previewTab)

    const panel = container.querySelector('#rb-body-panel-preview')!
    expect(panel.querySelector('.rb-preview-empty')?.textContent).toBe(
      'Nothing to preview yet.',
    )
    expect(panel.querySelector('.rb-md')).toBeNull()
  })

  it('keeps the textarea mounted and its markdown byte-identical across a round trip', () => {
    const { container, body, writeTab, previewTab } = renderEditor()
    const writePanel = container.querySelector('#rb-body-panel-write')!

    // Trailing spaces, a tab, and blank runs: exactly what a normalising
    // round-trip would eat. body_md is stored raw.
    const src = '# Keep  me\t\n\n\n-  a  \n'
    fireEvent.change(body, { target: { value: src } })

    fireEvent.click(previewTab)
    // The panel hides; the textarea inside it stays mounted, because the caret
    // and scroll position live in the DOM and an unmount would reset them.
    expect(writePanel).toHaveAttribute('hidden')
    expect(writePanel).toContainElement(body)
    expect(screen.getByLabelText(/plain markdown/)).toBe(body)

    fireEvent.click(writeTab)
    expect(writePanel).not.toHaveAttribute('hidden')
    expect(body.value).toBe(src)
  })
})

describe('EditView — body tabs follow the tabs pattern', () => {
  it('exposes exactly one selected tab, with roving tabindex and a linked panel', () => {
    const { container, writeTab, previewTab } = renderEditor()

    expect(writeTab).toHaveAttribute('aria-selected', 'true')
    expect(writeTab).toHaveAttribute('tabindex', '0')
    expect(previewTab).toHaveAttribute('aria-selected', 'false')
    expect(previewTab).toHaveAttribute('tabindex', '-1')

    // aria-controls resolves in both directions — the panel is always mounted.
    for (const tab of [writeTab, previewTab]) {
      const id = tab.getAttribute('aria-controls')!
      const panel = container.querySelector(`#${id}`)
      expect(panel).toHaveAttribute('role', 'tabpanel')
      expect(panel).toHaveAttribute('aria-labelledby', tab.id)
    }

    fireEvent.click(previewTab)
    expect(writeTab).toHaveAttribute('aria-selected', 'false')
    expect(writeTab).toHaveAttribute('tabindex', '-1')
    expect(previewTab).toHaveAttribute('aria-selected', 'true')
    expect(previewTab).toHaveAttribute('tabindex', '0')
  })

  it('moves selection and focus with Arrow/Home/End, wrapping at the ends', () => {
    const { writeTab, previewTab } = renderEditor()

    writeTab.focus()
    fireEvent.keyDown(writeTab, { key: 'ArrowRight' })
    expect(previewTab).toHaveAttribute('aria-selected', 'true')
    expect(previewTab).toHaveFocus()

    // Wraps forward off the end, back to the first tab.
    fireEvent.keyDown(previewTab, { key: 'ArrowRight' })
    expect(writeTab).toHaveAttribute('aria-selected', 'true')
    expect(writeTab).toHaveFocus()

    // ...and backward off the start.
    fireEvent.keyDown(writeTab, { key: 'ArrowLeft' })
    expect(previewTab).toHaveFocus()

    fireEvent.keyDown(previewTab, { key: 'Home' })
    expect(writeTab).toHaveAttribute('aria-selected', 'true')
    expect(writeTab).toHaveFocus()

    fireEvent.keyDown(writeTab, { key: 'End' })
    expect(previewTab).toHaveAttribute('aria-selected', 'true')
    expect(previewTab).toHaveFocus()
  })

  it('ignores keys the pattern does not own', () => {
    const { writeTab, previewTab } = renderEditor()

    fireEvent.keyDown(writeTab, { key: 'ArrowDown' })
    expect(writeTab).toHaveAttribute('aria-selected', 'true')
    expect(previewTab).toHaveAttribute('aria-selected', 'false')
  })
})
