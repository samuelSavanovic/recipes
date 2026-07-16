import { parseMainIngredients } from './mainIngredients'
import type { CookTime, Recipe } from './types'

export interface Filters {
  q?: string
  cuisine?: string
  time?: CookTime | ''
}

// Case- and diacritic-insensitive fold, so "jalapeno" finds "Jalapeño" and
// "puree" finds "purée". The ingredient vocabulary is free-typed, so accents
// land inconsistently and an exact-match search would strand entries.
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

// Search terms are ANDed, not treated as one substring: "chicken rice" matches a
// recipe carrying both, in either the title or the main-ingredient list, rather
// than requiring those five characters to appear literally and adjacently.
function terms(q: string): string[] {
  return fold(q).split(/\s+/).filter(Boolean)
}

// Tier 0: the title alone satisfies every term. Tier 1: matching needed the
// ingredients. Searching "chicken" must not bury "Chicken Stock" under an
// unrelated recipe that merely lists chicken, so tier drives the result order.
function tierFor(r: Recipe, ts: string[]): number | null {
  const title = fold(r.title)
  if (ts.every((t) => title.includes(t))) return 0

  const ingredients = parseMainIngredients(r.main).map(fold)
  const matchesAll = ts.every(
    (t) => title.includes(t) || ingredients.some((i) => i.includes(t)),
  )
  return matchesAll ? 1 : null
}

// Pure client-side filtering: search over title + main ingredients, exact
// cuisine, exact time bucket. An empty/absent filter field is a no-op.
//
// Ordering: with no search, input order is preserved (the store hands these over
// already title-sorted). With a search, results are re-ordered by match tier and
// then title — ranking lives here rather than leaking the tier rule into the
// component that renders the list.
export function filterRecipes(recipes: Recipe[], filters: Filters): Recipe[] {
  const q = (filters.q ?? '').trim()
  const cuisine = filters.cuisine ?? ''
  const time = filters.time ?? ''
  const ts = terms(q)

  const scoped = recipes.filter((r) => {
    if (cuisine && r.cuisine !== cuisine) return false
    if (time && r.cook_time !== time) return false
    return true
  })

  if (ts.length === 0) return scoped

  return scoped
    .map((r) => ({ r, tier: tierFor(r, ts) }))
    .filter((x): x is { r: Recipe; tier: number } => x.tier !== null)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        a.r.title.localeCompare(b.r.title, undefined, { sensitivity: 'base' }),
    )
    .map((x) => x.r)
}

// Distinct non-empty cuisines, sorted — drives the cuisine filter chips.
export function distinctCuisines(recipes: Recipe[]): string[] {
  return [...new Set(recipes.map((r) => r.cuisine).filter(Boolean))].sort()
}
