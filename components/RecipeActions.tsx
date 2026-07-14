'use client'

import { AppLink } from './AppLink'
import { useRecipes } from '@/lib/store'

// The recipe view's nav row: back to the book, plus an Edit button that only
// appears with an active edit session (UX gate — the API is the real gate).
export function RecipeActions({ slug }: { slug: string }) {
  const { hasToken } = useRecipes()
  return (
    <div className="rb-recipe-nav">
      <AppLink href="/" className="rb-link">
        ← the book
      </AppLink>
      {hasToken && (
        <AppLink href={`/edit/${slug}`} className="rb-btn">
          Edit
        </AppLink>
      )}
    </div>
  )
}
