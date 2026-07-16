import { describe, it, expect } from 'vitest'
import { filterRecipes, distinctCuisines } from './filter'
import type { Recipe } from './types'

const base = { main: '', body_md: '', created_at: 0, updated_at: 0 }
const cacio: Recipe = { ...base, id: 'cacio', title: 'Cacio e pepe', cuisine: 'Italian', cook_time: '15_30' }
const goulash: Recipe = { ...base, id: 'goulash', title: 'Veal Goulash', cuisine: 'Croatian', cook_time: 'over_60' }
const focaccia: Recipe = { ...base, id: 'focaccia', title: 'Focaccia', cuisine: 'Italian', cook_time: 'over_60' }
const stock: Recipe = { ...base, id: 'stock', title: 'Chicken Stock', cuisine: 'General', cook_time: 'over_60' }

const recipes = [cacio, goulash, focaccia, stock]

// A second corpus with `main` populated, for the search tiers. Kept apart from
// the fixtures above so those keep pinning the cuisine/time behaviour against
// recipes that carry no ingredients at all.
// Adobo exists to keep the ranking test honest: it is an ingredient-only match
// for "chicken" that sorts *before* the title match alphabetically, so the tier
// assertion fails against an implementation that just sorts by title.
const adobo: Recipe = {
  ...base,
  id: 'adobo',
  title: 'Adobo',
  cuisine: 'Filipino',
  cook_time: '30_60',
  main: 'Chicken, Soy Sauce',
}
const carbonara: Recipe = {
  ...base,
  id: 'carbonara',
  title: 'Carbonara',
  cuisine: 'Italian',
  cook_time: '15_30',
  main: 'Guanciale, Egg, Pecorino Romano',
}
const chickenStock: Recipe = {
  ...base,
  id: 'chicken-stock',
  title: 'Chicken Stock',
  cuisine: 'General',
  cook_time: 'over_60',
  main: 'Chicken Wings, Onion',
}
const katsu: Recipe = {
  ...base,
  id: 'katsu',
  title: 'Katsu Curry',
  cuisine: 'Japanese',
  cook_time: '30_60',
  main: 'Chicken, Panko',
}
const ramen: Recipe = {
  ...base,
  id: 'ramen',
  title: 'Ramen',
  cuisine: 'Japanese',
  cook_time: '30_60',
  main: 'Chicken, Rice, Egg',
}
const tacos: Recipe = {
  ...base,
  id: 'tacos',
  title: 'Tacos',
  cuisine: 'Mexican',
  cook_time: '15_30',
  main: 'Jalapeño, Tomato Purée',
}

const ingredientRecipes = [adobo, carbonara, chickenStock, katsu, ramen, tacos]

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

  it('matches main ingredients, not just the title', () => {
    expect(filterRecipes(ingredientRecipes, { q: 'guanciale' })).toEqual([carbonara])
  })

  it('ANDs whitespace-separated terms across title and ingredients', () => {
    // Neither recipe's title contains "chicken rice" literally; ramen carries
    // both as ingredients, carbonara carries neither.
    expect(filterRecipes(ingredientRecipes, { q: 'chicken rice' })).toEqual([ramen])
    // A term present in no field kills the whole match.
    expect(filterRecipes(ingredientRecipes, { q: 'chicken zzz' })).toEqual([])
  })

  it('splits terms across title and ingredients', () => {
    // "ramen" only in the title, "chicken" only in the ingredients.
    expect(filterRecipes(ingredientRecipes, { q: 'ramen chicken' })).toEqual([ramen])
  })

  it('folds diacritics in both the query and the data', () => {
    expect(filterRecipes(ingredientRecipes, { q: 'jalapeno' })).toEqual([tacos])
    expect(filterRecipes(ingredientRecipes, { q: 'JALAPEÑO' })).toEqual([tacos])
    expect(filterRecipes(ingredientRecipes, { q: 'puree' })).toEqual([tacos])
  })

  it('ranks title matches above ingredient-only matches', () => {
    // Adobo sorts first alphabetically, but only "Chicken Stock" satisfies the
    // query from its title alone, so the stock must lead.
    expect(filterRecipes(ingredientRecipes, { q: 'chicken' })).toEqual([
      chickenStock,
      adobo,
      katsu,
      ramen,
    ])
  })

  it('sorts alphabetically within a tier', () => {
    // Both are ingredient-only matches for "egg"; neither title contains it.
    expect(filterRecipes(ingredientRecipes, { q: 'egg' })).toEqual([carbonara, ramen])
  })

  it('still applies cuisine and time alongside an ingredient search', () => {
    expect(
      filterRecipes(ingredientRecipes, { q: 'chicken', cuisine: 'Japanese' }),
    ).toEqual([katsu, ramen])
    expect(
      filterRecipes(ingredientRecipes, { q: 'chicken', time: 'over_60' }),
    ).toEqual([chickenStock])
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
