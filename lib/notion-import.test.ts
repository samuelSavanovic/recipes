import { describe, it, expect } from 'vitest'
import {
  parseRecipeFile,
  mapCuisine,
  mapTime,
  firstCsvField,
} from './notion-import'

describe('parseRecipeFile', () => {
  // A real-shaped Cacio e pepe export, with a non-empty Main and a body table —
  // verifies main flows end-to-end from export format to model.
  const body = [
    '## Ingredients (for 2)',
    '',
    '- 400 g fresh tagliatelle (or 180 g dry spaghetti)',
    '- 100-120 g pecorino romano, finely grated',
    '',
    '## Common mistakes',
    '',
    '| Problem | Cause | Fix |',
    '| --- | --- | --- |',
    '| Cheese clumped | Pan too hot | Remove from heat |',
  ].join('\n')

  const content = `# Cacio e pepe\n\nCuisine: Italian\nLast cooked: May 19, 2026\nMain: Pecorino Romano, Pepper\nTime: <60min\n\n${body}\n`

  it('parses title, metadata, and verbatim body (main included)', () => {
    expect(parseRecipeFile(content)).toEqual({
      title: 'Cacio e pepe',
      cuisine: 'Italian',
      cook_time: '30_60',
      main: 'Pecorino Romano, Pepper',
      body_md: body,
    })
  })

  it('maps the Japanise → Japanese cuisine typo', () => {
    const md = `# Tangzhong Bread\n\nCuisine: Japanise\nMain: Flour\nTime: >60min\n\n## Ingredients\n\n- 50 g bread flour`
    const parsed = parseRecipeFile(md)
    expect(parsed?.cuisine).toBe('Japanese')
    expect(parsed?.cook_time).toBe('over_60')
  })

  it('returns null for the empty "Recipe" template (no Time property)', () => {
    const template = `# Recipe\n\n## Ingredients\n\n- \n\n## Steps\n\n1. \n\n## Notes\n\n-`
    expect(parseRecipeFile(template)).toBeNull()
  })
})

describe('mapTime', () => {
  it('maps Notion buckets to the cook_time union', () => {
    expect(mapTime('<30min')).toBe('15_30')
    expect(mapTime('<60min')).toBe('30_60')
    expect(mapTime('>60min')).toBe('over_60')
  })

  it('throws on an unknown bucket rather than guessing', () => {
    expect(() => mapTime('<5min')).toThrow(/Unknown Time bucket/)
  })
})

describe('mapCuisine', () => {
  it('fixes the typo and passes others through', () => {
    expect(mapCuisine('Japanise')).toBe('Japanese')
    expect(mapCuisine('  Italian ')).toBe('Italian')
  })
})

describe('firstCsvField', () => {
  it('reads unquoted, quoted-with-comma, and BOM-prefixed names', () => {
    expect(firstCsvField('Pizza Dough,General,Flour,>60min')).toBe('Pizza Dough')
    expect(firstCsvField('"Turkey Ragù Lasagna (rosso, with besciamella)",Italian')).toBe(
      'Turkey Ragù Lasagna (rosso, with besciamella)',
    )
    expect(firstCsvField('﻿Name,Cuisine,Last cooked,Main,Time')).toBe('Name')
    expect(firstCsvField('"Aromatic Garlic Dipping Oil ",Italian')).toBe(
      'Aromatic Garlic Dipping Oil',
    )
  })
})
