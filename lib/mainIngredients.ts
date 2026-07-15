// Shared parsing/formatting for the `main` (main ingredients) field: a
// comma-separated free-text list. Used by both the editor's badge input
// (components/MainIngredientsInput.tsx) and the recipe display view
// (components/RecipeArticle.tsx), so the split/normalize rules live in one
// place instead of drifting apart between the two.

export function parseMainIngredients(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function serializeMainIngredients(ingredients: string[]): string {
  return ingredients.join(', ')
}

// Title-cases a raw ingredient, but only touches words that arrive fully
// lowercase. A word that already carries any capitalization — an acronym
// ("DOP"), a name ("McDonald"), or an already-canonical vocabulary entry
// ("Pecorino Romano") — passes through untouched. This makes normalization
// safe to apply uniformly to both free-typed text and autocomplete
// selections: running it on an already-correct value is a no-op.
export function normalizeIngredient(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word === word.toLowerCase() ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}
