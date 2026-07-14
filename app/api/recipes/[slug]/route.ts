import { NextResponse } from 'next/server'
import { deleteRecipe, getDb, updateRecipe } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { parseRecipeInput } from '@/lib/validate'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ slug: string }> }

// PUT — gated. Updates the mutable fields; the slug (id) is immutable, so a
// rename never breaks a shared link. 404 if the recipe is gone.
export async function PUT(req: Request, ctx: Context) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await ctx.params

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

  const updated = await updateRecipe(getDb(), slug, parsed.value)
  if (!updated) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }
  return NextResponse.json(updated)
}

// DELETE — gated. 404 if there was nothing to delete.
export async function DELETE(req: Request, ctx: Context) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await ctx.params
  const deleted = await deleteRecipe(getDb(), slug)
  if (!deleted) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
