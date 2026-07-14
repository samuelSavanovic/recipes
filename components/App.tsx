'use client'

import { useRouter } from 'next/navigation'
import { useRecipes } from '@/lib/store'
import { useAppPath } from '@/lib/use-app-path'
import { TopBar } from './TopBar'
import { ListView } from './ListView'
import { RecipeView } from './RecipeView'
import { EditView } from './EditView'
import { UnlockDialog } from './UnlockDialog'

// The client shell. It switches views off the real window.location path so the
// same cached "/" document can render deep links offline (the SW navigation
// fallback). Path is null until mounted, which defers view rendering to after
// hydration so a cached "/" shell served for a "/recipe/x" URL doesn't mismatch.
export default function App() {
  const path = useAppPath()

  return (
    <div className="rb-root">
      <TopBar />
      {path !== null ? <ViewForPath pathname={path} /> : null}
    </div>
  )
}

function ViewForPath({ pathname }: { pathname: string }) {
  if (pathname.startsWith('/recipe/')) {
    const slug = decodeURIComponent(pathname.slice('/recipe/'.length))
    if (slug) return <RecipeView slug={slug} />
  }
  if (pathname === '/new') {
    return <EditGate />
  }
  if (pathname.startsWith('/edit/')) {
    const slug = decodeURIComponent(pathname.slice('/edit/'.length))
    if (slug) return <EditGate slug={slug} />
  }
  // The list is the shell's home and the safe fallback for any other path.
  return <ListView />
}

// Gate the editor behind an unlock. When locked, show the dialog inline;
// cancelling returns home, and a successful unlock re-renders into the editor.
function EditGate({ slug }: { slug?: string }) {
  const { hasToken } = useRecipes()
  const router = useRouter()

  if (!hasToken) {
    return (
      <main className="rb-main">
        <div className="rb-empty">Editing is locked.</div>
        <UnlockDialog onClose={() => router.push('/')} onUnlocked={() => {}} />
      </main>
    )
  }
  return <EditView slug={slug} />
}
