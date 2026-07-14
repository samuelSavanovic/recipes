import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDb, getRecipeBySlug } from '@/lib/db'
import { cookTimeLabel } from '@/lib/types'
import { RecipeArticle } from '@/components/RecipeArticle'
import { TopBar } from '@/components/TopBar'

// Server-rendered recipe page: the share-link audience gets full content in the
// first response (not a shell → JS → empty-cache round trip), and the title is
// set for link previews. Always request-time (never statically cached), so the
// HTML is at least as fresh as the client's IndexedDB.
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const recipe = await getRecipeBySlug(getDb(), slug)
  if (!recipe) return { title: 'Recipe not found' }
  return {
    title: recipe.title,
    description: [recipe.cuisine, cookTimeLabel(recipe.cook_time)]
      .filter(Boolean)
      .join(' · '),
  }
}

export default async function RecipePage({ params }: Params) {
  const { slug } = await params
  const recipe = await getRecipeBySlug(getDb(), slug)
  if (!recipe) notFound()

  return (
    <div className="rb-root">
      <TopBar />
      <RecipeArticle recipe={recipe} />
    </div>
  )
}
