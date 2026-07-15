import { describe, it, expect } from 'vitest'
import { normalizeIngredient, parseMainIngredients, serializeMainIngredients } from './mainIngredients'

describe('parseMainIngredients', () => {
  it('splits on comma and trims each entry', () => {
    expect(parseMainIngredients('Pasta, Eggs,Pancetta ,  Pecorino Romano')).toEqual([
      'Pasta',
      'Eggs',
      'Pancetta',
      'Pecorino Romano',
    ])
  })

  it('drops empty segments from stray or trailing commas', () => {
    expect(parseMainIngredients('Olive Oil,, Garlic,')).toEqual(['Olive Oil', 'Garlic'])
  })

  it('returns an empty array for an empty string', () => {
    expect(parseMainIngredients('')).toEqual([])
  })
})

describe('serializeMainIngredients', () => {
  it('joins with ", "', () => {
    expect(serializeMainIngredients(['Gouda', 'Pasta'])).toBe('Gouda, Pasta')
  })

  it('returns an empty string for an empty list', () => {
    expect(serializeMainIngredients([])).toBe('')
  })
})

describe('normalizeIngredient', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeIngredient('  gouda  ')).toBe('Gouda')
  })

  it('title-cases a fully lowercase multi-word entry', () => {
    expect(normalizeIngredient('olive oil')).toBe('Olive Oil')
  })

  it('leaves a word with any existing capitalization untouched', () => {
    // "DOP" is an acronym — naive title-casing would mangle it to "Dop".
    expect(normalizeIngredient('Pecorino Romano DOP')).toBe('Pecorino Romano DOP')
  })

  it('leaves an already-canonical value unchanged (safe to re-apply on autocomplete picks)', () => {
    expect(normalizeIngredient('Bergader Edelpilz')).toBe('Bergader Edelpilz')
  })

  it('collapses internal whitespace runs to single spaces', () => {
    expect(normalizeIngredient('olive   oil')).toBe('Olive Oil')
  })
})
