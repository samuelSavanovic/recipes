import { describe, it, expect } from 'vitest'
import { filterRecipes, distinctCuisines } from './filter'
import type { Recipe } from './types'

const base = { main: '', body_md: '', created_at: 0, updated_at: 0 }
const cacio: Recipe = { ...base, id: 'cacio', title: 'Cacio e pepe', cuisine: 'Italian', cook_time: '15_30' }
const goulash: Recipe = { ...base, id: 'goulash', title: 'Veal Goulash', cuisine: 'Croatian', cook_time: 'over_60' }
const focaccia: Recipe = { ...base, id: 'focaccia', title: 'Focaccia', cuisine: 'Italian', cook_time: 'over_60' }
const stock: Recipe = { ...base, id: 'stock', title: 'Chicken Stock', cuisine: 'General', cook_time: 'over_60' }

const recipes = [cacio, goulash, focaccia, stock]

describe('filterRecipes', () => {
  it('returns everything when no filters are set', () => {
    expect(filterRecipes(recipes, {})).toEqual([cacio, goulash, focaccia, stock])
  })

  it('filters by cuisine (exact)', () => {
    expect(filterRecipes(recipes, { cuisine: 'Italian' })).toEqual([cacio, focaccia])
  })

  it('filters by time bucket (exact)', () => {
    expect(filterRecipes(recipes, { time: 'over_60' })).toEqual([
      goulash,
      focaccia,
      stock,
    ])
  })

  it('filters by case-insensitive title substring', () => {
    expect(filterRecipes(recipes, { q: 'cacio' })).toEqual([cacio])
    expect(filterRecipes(recipes, { q: 'STOCK' })).toEqual([stock])
  })

  it('combines cuisine + time + search', () => {
    expect(
      filterRecipes(recipes, { cuisine: 'Italian', time: 'over_60', q: 'foc' }),
    ).toEqual([focaccia])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterRecipes(recipes, { cuisine: 'Italian', time: '15_30', q: 'zzz' })).toEqual(
      [],
    )
  })
})

describe('distinctCuisines', () => {
  it('returns sorted, de-duplicated, non-empty cuisines', () => {
    expect(distinctCuisines(recipes)).toEqual(['Croatian', 'General', 'Italian'])
  })

  it('drops empty cuisines', () => {
    const withBlank: Recipe = { ...base, id: 'x', title: 'X', cuisine: '', cook_time: '15_30' }
    expect(distinctCuisines([cacio, withBlank])).toEqual(['Italian'])
  })
})
