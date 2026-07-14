// Import the Notion export into the DB. Source of truth = the Recipes/*.md files
// (title from H1, metadata from the property block, body kept verbatim). The
// export is cross-checked against the *_all.csv; any disagreement is a loud exit.
// Refuses to overwrite a non-empty table without --force.
//
//   npm run db:import            # into an empty table
//   npm run db:import -- --force # replace all
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRecipe, ensureSchema, getDb } from '@/lib/db'
import {
  firstCsvField,
  parseRecipeFile,
  type ParsedRecipe,
} from '@/lib/notion-import'
import { COOK_TIMES, type CookTime } from '@/lib/types'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const exportDir = resolve(root, 'notion_export')
const recipesDir = resolve(exportDir, 'Recipes')

function loadParsed(): { recipes: ParsedRecipe[]; skipped: string[] } {
  const files = readdirSync(recipesDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
  const recipes: ParsedRecipe[] = []
  const skipped: string[] = []
  for (const f of files) {
    const parsed = parseRecipeFile(readFileSync(join(recipesDir, f), 'utf8'))
    if (parsed) recipes.push(parsed)
    else skipped.push(f)
  }
  return { recipes, skipped }
}

function loadCsvTitles(): string[] {
  const csvName = readdirSync(exportDir).find((f) => f.endsWith('_all.csv'))
  if (!csvName) throw new Error('Could not find *_all.csv in notion_export/')
  const content = readFileSync(resolve(exportDir, csvName), 'utf8')
  return content
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map(firstCsvField)
    .filter((name) => name !== 'Name') // drop the header
}

function reconcile(parsed: ParsedRecipe[], csvTitles: string[]): void {
  const mdSet = new Set(parsed.map((r) => r.title))
  const csvSet = new Set(csvTitles)
  const missingInMd = [...csvSet].filter((t) => !mdSet.has(t))
  const missingInCsv = [...mdSet].filter((t) => !csvSet.has(t))

  if (missingInMd.length || missingInCsv.length) {
    console.error('✗ Reconciliation failed — export .md and CSV disagree:')
    if (missingInMd.length)
      console.error('  In CSV but no matching .md:', missingInMd)
    if (missingInCsv.length)
      console.error('  In .md but not in the CSV:', missingInCsv)
    process.exit(1)
  }
  if (mdSet.size !== csvSet.size) {
    console.error(
      `✗ Count mismatch after de-dup: ${mdSet.size} md titles vs ${csvSet.size} csv titles.`,
    )
    process.exit(1)
  }
}

function bucketReport(created: Array<{ title: string; cook_time: CookTime }>): void {
  // 15_30 first — that group absorbed Notion's "<30min", so genuinely-quick
  // recipes hide here and can be hand-fixed to under_15 in the app afterward.
  const order: CookTime[] = ['15_30', 'under_15', '30_60', 'over_60']
  console.log(
    '\nTime-bucket report — review the 15–30 min group for genuinely-quick (<15) recipes:',
  )
  for (const bucket of order) {
    const items = created
      .filter((r) => r.cook_time === bucket)
      .sort((a, b) => a.title.localeCompare(b.title))
    if (!items.length) continue
    const label = COOK_TIMES.find((b) => b.id === bucket)?.label ?? bucket
    console.log(`\n  [${label}]  (${items.length})`)
    for (const r of items) console.log(`    - ${r.title}`)
  }
}

async function main() {
  const force = process.argv.includes('--force')

  const { recipes, skipped } = loadParsed()
  const csvTitles = loadCsvTitles()

  console.log(`Parsed ${recipes.length} recipes from ${recipesDir}`)
  if (skipped.length)
    console.log(`Skipped (template / no metadata): ${skipped.join(', ')}`)

  reconcile(recipes, csvTitles)
  console.log(
    `✓ Reconciled ${recipes.length} recipes against ${csvTitles.length} CSV rows.`,
  )

  const db = getDb()
  await ensureSchema(db)

  const existing = await db.execute('SELECT COUNT(*) AS n FROM recipes')
  const count = Number(existing.rows[0].n)
  if (count > 0 && !force) {
    console.error(
      `✗ recipes table already has ${count} rows. Re-run with --force to replace all.`,
    )
    process.exit(1)
  }
  if (count > 0 && force) {
    await db.execute('DELETE FROM recipes')
    console.log(`Cleared ${count} existing rows (--force).`)
  }

  const now = Date.now()
  const created: Array<{ title: string; cook_time: CookTime }> = []
  for (const r of recipes) {
    const rec = await createRecipe(db, r, now)
    created.push({ title: rec.title, cook_time: rec.cook_time })
  }

  console.log(`\n✓ Imported ${created.length} recipes.`)
  bucketReport(created)
}

main().catch((err) => {
  console.error('db:import failed:', err)
  process.exit(1)
})
