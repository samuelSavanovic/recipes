'use client'

import { useRecipes } from '@/lib/store'
import { RecipeArticle } from './RecipeArticle'

// Offline / client-shell path: render a recipe from the local store when the SW
// served the cached "/" shell for a "/recipe/[slug]" deep link. Online, the RSC
// page at app/recipe/[slug] handles this route instead.
export function RecipeView({ slug }: { slug: string }) {
  const { getBySlug, loading } = useRecipes()
  const recipe = getBySlug(slug)

  if (recipe) return <RecipeArticle recipe={recipe} />

  return (
    <main className="rb-main">
      <div className="rb-empty">
        {loading ? 'Loading…' : 'This recipe isn’t in your offline cache yet.'}
      </div>
    </main>
  )
}
