import type { CookTime, Recipe } from './types'

export interface Filters {
  q?: string
  cuisine?: string
  time?: CookTime | ''
}

// Pure client-side filtering: title search (case-insensitive substring),
// exact cuisine, exact time bucket. An empty/absent filter field is a no-op.
export function filterRecipes(recipes: Recipe[], filters: Filters): Recipe[] {
  const q = (filters.q ?? '').trim().toLowerCase()
  const cuisine = filters.cuisine ?? ''
  const time = filters.time ?? ''

  return recipes.filter((r) => {
    if (cuisine && r.cuisine !== cuisine) return false
    if (time && r.cook_time !== time) return false
    if (q && !r.title.toLowerCase().includes(q)) return false
    return true
  })
}

// Distinct non-empty cuisines, sorted — drives the cuisine filter chips.
export function distinctCuisines(recipes: Recipe[]): string[] {
  return [...new Set(recipes.map((r) => r.cuisine).filter(Boolean))].sort()
}
