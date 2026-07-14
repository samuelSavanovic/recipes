import { NextResponse } from 'next/server'
import { createRecipe, getAllRecipes, getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { parseRecipeInput } from '@/lib/validate'

// Reads hit the live DB on every request (never statically cached), so the
// client's background refresh always gets current data.
export const dynamic = 'force-dynamic'

// GET — public. Every recipe, for the client to cache into IndexedDB.
export async function GET() {
  const recipes = await getAllRecipes(getDb())
  return NextResponse.json(recipes)
}

// POST — gated. Server mints the slug; the client never chooses ids.
export async function POST(req: Request) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseRecipeInput(body)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'Validation failed', fields: parsed.errors },
      { status: 400 },
    )
  }

  const recipe = await createRecipe(getDb(), parsed.value)
  return NextResponse.json(recipe, { status: 201 })
}
