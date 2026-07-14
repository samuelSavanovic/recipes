import { describe, it, expect, beforeEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { slugify, nextAvailableSlug } from './slug'
import { ensureSchema, createRecipe } from './db'
import type { RecipeInput } from './types'

describe('slugify', () => {
  it('lowercases, hyphenates, and drops diacritics', () => {
    expect(slugify('Ragù di Tacchino alla Bolognese')).toEqual(
      'ragu-di-tacchino-alla-bolognese',
    )
  })

  it('strips punctuation and collapses separators', () => {
    expect(slugify('Spaghetti Aglio, Olio e Pecorino')).toEqual(
      'spaghetti-aglio-olio-e-pecorino',
    )
  })

  it('keeps internal hyphens but never leading/trailing ones', () => {
    expect(slugify('  —Oven-Roasted Potatoes!—  ')).toEqual('oven-roasted-potatoes')
  })

  it('caps length at 60 chars with no dangling hyphen', () => {
    const slug = slugify(
      'Chicken Breast with Seared Garlic Mushrooms and Oven-Roasted Potatoes',
    )
    expect(slug).toEqual(
      'chicken-breast-with-seared-garlic-mushrooms-and-oven-roasted',
    )
    expect(slug.length).toBe(60)
  })

  it('returns empty string for a title with no slug-able characters', () => {
    expect(slugify('!!! ,,, ???')).toEqual('')
  })
})

describe('nextAvailableSlug (pure)', () => {
  it('returns the base when free', () => {
    expect(nextAvailableSlug('cacio-e-pepe', () => false)).toEqual('cacio-e-pepe')
  })

  it('appends -2, -3 … past taken slugs', () => {
    const taken = new Set(['gnocchi', 'gnocchi-2'])
    expect(nextAvailableSlug('gnocchi', (s) => taken.has(s))).toEqual('gnocchi-3')
  })

  it('falls back to "recipe" for an empty base', () => {
    expect(nextAvailableSlug('', () => false)).toEqual('recipe')
  })
})

describe('createRecipe slug collisions (in-memory db)', () => {
  let db: Client
  const input = (title: string): RecipeInput => ({
    title,
    cuisine: 'Italian',
    cook_time: '30_60',
    main: '',
    body_md: '',
  })

  beforeEach(async () => {
    db = createClient({ url: ':memory:' })
    await ensureSchema(db)
  })

  it('assigns base, -2, -3 to same-titled recipes', async () => {
    const a = await createRecipe(db, input('Gnocchi'))
    const b = await createRecipe(db, input('Gnocchi'))
    const c = await createRecipe(db, input('Gnocchi'))
    expect([a.id, b.id, c.id]).toEqual(['gnocchi', 'gnocchi-2', 'gnocchi-3'])
  })
})
