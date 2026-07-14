import { cookTimeLabel, type Recipe } from '@/lib/types'
import { RecipeMarkdown } from './RecipeMarkdown'
import { RecipeActions } from './RecipeActions'

// Shared recipe presentation — one component behind both render paths: the SSR
// recipe page (online) and the client shell (offline). Title/meta/markdown are
// identical either way; only the nav actions are a client island.
export function RecipeArticle({ recipe }: { recipe: Recipe }) {
  return (
    <main className="rb-main rb-recipe">
      <RecipeActions slug={recipe.id} />
      <div className="rb-recipe-head">
        <h1 className="rb-recipe-title">{recipe.title}</h1>
        <div className="rb-recipe-meta">
          <span className="rb-tag">{recipe.cuisine || '—'}</span>
          <span className="rb-tag rb-tag-time">
            {cookTimeLabel(recipe.cook_time)}
          </span>
          {recipe.main && <span className="rb-tag rb-tag-main">{recipe.main}</span>}
        </div>
      </div>
      <article className="rb-recipe-body">
        <RecipeMarkdown source={recipe.body_md} />
      </article>
    </main>
  )
}
