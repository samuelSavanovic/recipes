import { createClient, type Client, type Row } from '@libsql/client'
import type { CookTime, Recipe, RecipeInput } from './types'
import { nextAvailableSlug, slugify } from './slug'

// One libSQL code path for every backend: Turso in production, a local
// `file:local.db` when TURSO_* is unset, or an in-memory db in tests (which set
// TURSO_DATABASE_URL=':memory:'). Callers pass an explicit Client so tests can
// isolate; the app uses the process-wide singleton via getDb().

let singleton: Client | null = null

export function createDb(url?: string): Client {
  const resolved = url ?? process.env.TURSO_DATABASE_URL
  if (resolved) {
    return createClient({ url: resolved, authToken: process.env.TURSO_AUTH_TOKEN })
  }
  console.warn(
    '[db] TURSO_DATABASE_URL is unset — falling back to local file:local.db. ' +
      'This is expected for local dev; set TURSO_* for production.',
  )
  return createClient({ url: 'file:local.db' })
}

export function getDb(): Client {
  if (!singleton) singleton = createDb()
  return singleton
}

// Test-only: drop the cached client so the next getDb() rebuilds from the
// current env (used to spin up a fresh :memory: db per test).
export function resetDb(): void {
  singleton = null
}

export async function ensureSchema(db: Client): Promise<void> {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS recipes (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        cuisine    TEXT NOT NULL DEFAULT '',
        cook_time  TEXT NOT NULL,
        main       TEXT NOT NULL DEFAULT '',
        body_md    TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine)`,
      `CREATE INDEX IF NOT EXISTS idx_recipes_cook_time ON recipes(cook_time)`,
    ],
    'write',
  )
}

function rowToRecipe(row: Row): Recipe {
  return {
    id: String(row.id),
    title: String(row.title),
    cuisine: String(row.cuisine),
    cook_time: String(row.cook_time) as CookTime, // constrained on write
    main: String(row.main),
    body_md: String(row.body_md),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  }
}

export async function getAllRecipes(db: Client): Promise<Recipe[]> {
  const res = await db.execute('SELECT * FROM recipes ORDER BY title COLLATE NOCASE')
  return res.rows.map(rowToRecipe)
}

export async function getRecipeBySlug(
  db: Client,
  slug: string,
): Promise<Recipe | null> {
  const res = await db.execute({
    sql: 'SELECT * FROM recipes WHERE id = ? LIMIT 1',
    args: [slug],
  })
  return res.rows.length ? rowToRecipe(res.rows[0]) : null
}

// Create a recipe, minting a collision-free slug server-side. Optionally accept
// a pre-chosen id (used by the import to preserve deterministic ids); it still
// runs through collision resolution against existing ids.
export async function createRecipe(
  db: Client,
  input: RecipeInput,
  now: number = Date.now(),
): Promise<Recipe> {
  const existing = await db.execute('SELECT id FROM recipes')
  const taken = new Set(existing.rows.map((r) => String(r.id)))
  const id = nextAvailableSlug(slugify(input.title), (s) => taken.has(s))

  const recipe: Recipe = {
    id,
    title: input.title,
    cuisine: input.cuisine,
    cook_time: input.cook_time,
    main: input.main,
    body_md: input.body_md,
    created_at: now,
    updated_at: now,
  }

  await db.execute({
    sql: `INSERT INTO recipes (id, title, cuisine, cook_time, main, body_md, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      recipe.id,
      recipe.title,
      recipe.cuisine,
      recipe.cook_time,
      recipe.main,
      recipe.body_md,
      recipe.created_at,
      recipe.updated_at,
    ],
  })
  return recipe
}

// Update the mutable fields of a recipe. The slug (id) is immutable — renaming
// the title never re-slugs, so shared links stay valid. Returns null if no such
// recipe exists.
export async function updateRecipe(
  db: Client,
  slug: string,
  input: RecipeInput,
  now: number = Date.now(),
): Promise<Recipe | null> {
  const res = await db.execute({
    sql: `UPDATE recipes
          SET title = ?, cuisine = ?, cook_time = ?, main = ?, body_md = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      input.title,
      input.cuisine,
      input.cook_time,
      input.main,
      input.body_md,
      now,
      slug,
    ],
  })
  if (res.rowsAffected === 0) return null
  return getRecipeBySlug(db, slug)
}

export async function deleteRecipe(db: Client, slug: string): Promise<boolean> {
  const res = await db.execute({
    sql: 'DELETE FROM recipes WHERE id = ?',
    args: [slug],
  })
  return res.rowsAffected > 0
}
