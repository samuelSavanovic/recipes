// Idempotent schema creation. `npm run db:setup` (loads .env.local if present;
// otherwise lib/db falls back to file:local.db).
import { ensureSchema, getDb } from '@/lib/db'

async function main() {
  const db = getDb()
  await ensureSchema(db)
  console.log('✓ Schema ensured (recipes table + indexes).')
}

main().catch((err) => {
  console.error('db:setup failed:', err)
  process.exit(1)
})
