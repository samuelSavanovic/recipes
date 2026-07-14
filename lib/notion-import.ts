import type { CookTime } from './types'

// Pure Notion-export parsing + mappings, shared by the import script and its
// tests. No fs/db here so it stays testable in isolation.

export interface ParsedRecipe {
  title: string
  cuisine: string
  cook_time: CookTime
  main: string
  body_md: string
}

// Data cleaning: the sole cuisine typo in the export.
export function mapCuisine(raw: string): string {
  const c = raw.trim()
  return c === 'Japanise' ? 'Japanese' : c
}

// Notion only ever used three time buckets; under_15 starts life unused. Unknown
// values are a hard error — the import surfaces bad data, it doesn't guess.
export function mapTime(raw: string): CookTime {
  switch (raw.trim()) {
    case '<30min':
      return '15_30'
    case '<60min':
      return '30_60'
    case '>60min':
      return 'over_60'
    default:
      throw new Error(`Unknown Time bucket: ${JSON.stringify(raw)}`)
  }
}

const PROP_RE = /^(Cuisine|Last cooked|Main|Time):\s*(.*)$/

// Parse one exported `Recipes/*.md`: line-1 H1 → title; the property block →
// metadata; the remainder is kept verbatim as body_md (only the title, property
// block, and leading blank lines are stripped). Returns null for the empty
// "Recipe" template (no Time property), which is the one expected skip.
export function parseRecipeFile(content: string): ParsedRecipe | null {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let i = 0

  while (i < lines.length && lines[i].trim() === '') i++
  const h1 = lines[i]?.match(/^#\s+(.*)$/)
  if (!h1) return null
  const title = h1[1].trim()
  i++

  while (i < lines.length && lines[i].trim() === '') i++

  const props: Record<string, string> = {}
  while (i < lines.length) {
    const m = lines[i].match(PROP_RE)
    if (!m) break
    props[m[1]] = m[2].trim()
    i++
  }

  // No Time → the empty template, not a real recipe.
  if (props['Time'] === undefined) return null

  while (i < lines.length && lines[i].trim() === '') i++
  const body_md = lines.slice(i).join('\n').replace(/\s+$/, '')

  return {
    title,
    cuisine: mapCuisine(props['Cuisine'] ?? ''),
    cook_time: mapTime(props['Time']),
    main: (props['Main'] ?? '').trim(),
    body_md,
  }
}

// Extract the first CSV field (the recipe Name), handling a leading BOM and
// quoted values with "" escapes. Used only for reconciliation against the export.
export function firstCsvField(line: string): string {
  const s = line.replace(/^﻿/, '')
  if (s[0] === '"') {
    let out = ''
    let i = 1
    while (i < s.length) {
      if (s[i] === '"') {
        if (s[i + 1] === '"') {
          out += '"'
          i += 2
          continue
        }
        break
      }
      out += s[i++]
    }
    return out.trim()
  }
  const comma = s.indexOf(',')
  return (comma === -1 ? s : s.slice(0, comma)).trim()
}
