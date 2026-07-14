import { isCookTime, type CookTime, type RecipeInput } from './types'

// Hand-rolled unknown → RecipeInput parser (no zod — one entity doesn't justify
// the dependency). Returns typed input or a map of field → message.

export type ValidationResult =
  | { ok: true; value: RecipeInput }
  | { ok: false; errors: Record<string, string> }

const COOK_TIME_MESSAGE =
  'cook_time must be one of: under_15, 15_30, 30_60, over_60'

export function parseRecipeInput(data: unknown): ValidationResult {
  if (typeof data !== 'object' || data === null) {
    return { ok: false, errors: { body: 'Request body must be a JSON object' } }
  }
  const d = data as Record<string, unknown>
  const errors: Record<string, string> = {}

  // Title: required, trimmed.
  const title = typeof d.title === 'string' ? d.title.trim() : ''
  if (title.length === 0) errors.title = 'title is required'

  // cook_time: must be a valid bucket.
  if (!isCookTime(d.cook_time)) errors.cook_time = COOK_TIME_MESSAGE

  // Free-text fields: absent → ''; present-but-not-a-string → error.
  const cuisine = optionalString(d.cuisine, 'cuisine', errors)?.trim() ?? ''
  const main = optionalString(d.main, 'main', errors)?.trim() ?? ''
  // body_md is the markdown source of truth — kept verbatim, never trimmed.
  const body_md = optionalString(d.body_md, 'body_md', errors) ?? ''

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      title,
      cuisine,
      cook_time: d.cook_time as CookTime,
      main,
      body_md,
    },
  }
}

function optionalString(
  value: unknown,
  field: string,
  errors: Record<string, string>,
): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    errors[field] = `${field} must be a string`
    return undefined
  }
  return value
}
