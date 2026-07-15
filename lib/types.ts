// The recipe data model. `cook_time` is a closed union, not a loose string, so
// the compiler rejects bad buckets at every boundary (see lib/validate.ts).

export type CookTime = 'under_15' | '15_30' | '30_60' | 'over_60'

export interface Recipe {
  id: string // slug, stable across renames
  title: string
  cuisine: string
  cook_time: CookTime
  main: string // main ingredients, free text (from Notion "Main")
  body_md: string // raw markdown, source of truth — never transformed
  created_at: number // epoch ms
  updated_at: number // epoch ms
}

// The editable fields of a recipe (everything the client sends; id + timestamps
// are server-owned).
export interface RecipeInput {
  title: string
  cuisine: string
  cook_time: CookTime
  main: string
  body_md: string
}

// Ordered bucket list — drives the time filter chips and the editor's segmented
// control, and doubles as the source of valid `cook_time` values.
export const COOK_TIMES: ReadonlyArray<{ id: CookTime; label: string }> = [
  { id: 'under_15', label: '< 15 min' },
  { id: '15_30', label: '15–30 min' },
  { id: '30_60', label: '30–60 min' },
  { id: 'over_60', label: '60+ min' },
] as const

export function isCookTime(value: unknown): value is CookTime {
  return (
    typeof value === 'string' && COOK_TIMES.some((b) => b.id === value)
  )
}

export function cookTimeLabel(id: CookTime): string {
  return COOK_TIMES.find((b) => b.id === id)?.label ?? '—'
}

// Seed suggestions for the cuisine autocomplete (components/CuisineInput.tsx).
// Cuisine itself stays free text — this just gives the field something to
// suggest before any matching recipe exists.
export const COMMON_CUISINES: readonly string[] = [
  'Italian', 'French', 'Spanish', 'Greek', 'Mexican', 'American',
  'Chinese', 'Japanese', 'Thai', 'Indian', 'Korean', 'Vietnamese',
  'Mediterranean', 'Middle Eastern', 'Croatian', 'General',
]
