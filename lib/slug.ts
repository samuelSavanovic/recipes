// Pure slug helpers, shared by the create API and the Notion import so both
// produce identical ids. No DB access here — collision detection is delegated to
// a `taken` predicate the caller wires to its own source of existing ids.

const MAX_SLUG_LEN = 60

export function slugify(title: string): string {
  return title
    .normalize('NFKD') // split accented letters into base + combining mark
    .replace(/[\u0300-\u036f]/g, '') // drop the combining marks: "Ragù" → "Ragu"
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // strip punctuation ("Aglio, Olio" → "aglio olio")
    .trim()
    .replace(/[\s-]+/g, '-') // runs of space/hyphen → a single hyphen
    .replace(/^-+|-+$/g, '') // no leading/trailing hyphens
    .slice(0, MAX_SLUG_LEN)
    .replace(/-+$/g, '') // slice may have left a dangling hyphen
}

// Given a base slug and a predicate reporting which slugs are already used,
// return the first free id: the base itself, else "-2", "-3", … . An empty base
// (title was all punctuation) falls back to "recipe".
export function nextAvailableSlug(
  base: string,
  taken: (slug: string) => boolean,
): string {
  const root = base || 'recipe'
  if (!taken(root)) return root
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`
    if (!taken(candidate)) return candidate
  }
}
