// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RecipeMarkdown } from './RecipeMarkdown'

afterEach(() => cleanup())

describe('RecipeMarkdown — GFM tables render as field-cards', () => {
  // A real "Common mistakes" table from the Cacio e pepe export.
  const tableSrc = [
    '| Problem | Cause | Fix |',
    '| --- | --- | --- |',
    '| Cheese clumped instead of melting | Pan too hot when cheese added | Remove from heat, wait longer next time |',
    '| Sauce watery | Too much water, not enough cheese | Add more cheese, toss harder |',
  ].join('\n')

  it('wraps the table in a field-card and preserves thead/tbody structure', () => {
    const { container } = render(<RecipeMarkdown source={tableSrc} />)

    // Field-card wrapper + table class (the signature element).
    const table = container.querySelector('.rb-table-wrap > table.rb-table')
    expect(table).not.toBeNull()

    const headers = Array.from(container.querySelectorAll('thead th')).map(
      (th) => th.textContent,
    )
    expect(headers).toEqual(['Problem', 'Cause', 'Fix'])

    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(2)

    const firstRow = Array.from(rows[0].querySelectorAll('td')).map(
      (td) => td.textContent,
    )
    expect(firstRow).toEqual([
      'Cheese clumped instead of melting',
      'Pan too hot when cheese added',
      'Remove from heat, wait longer next time',
    ])
  })
})

describe('RecipeMarkdown — nested lists', () => {
  it('renders a nested <ul> inside a list item', () => {
    const src = ['- a', '  - a1', '  - a2', '- b'].join('\n')
    const { container } = render(<RecipeMarkdown source={src} />)

    const outer = container.querySelector('ul.rb-list')
    expect(outer).not.toBeNull()

    const outerItems = outer!.children
    expect(outerItems.length).toBe(2)

    // First item carries a nested list of two items.
    const nested = outerItems[0].querySelector('ul.rb-list')
    expect(nested).not.toBeNull()
    expect(nested!.querySelectorAll('li').length).toBe(2)
  })
})

describe('RecipeMarkdown — HTML escaping stays on', () => {
  it('renders raw <script> as inert text, creating no script element', () => {
    const src = 'Careful: <script>alert(1)</script> stays text.'
    const { container } = render(<RecipeMarkdown source={src} />)

    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('alert(1)')
  })
})
