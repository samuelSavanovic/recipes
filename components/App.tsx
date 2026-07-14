'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useRecipes } from '@/lib/store'
import { useIsClient } from '@/lib/use-is-client'
import { TopBar } from './TopBar'
import { ListView } from './ListView'
import { RecipeView } from './RecipeView'
import { EditView } from './EditView'
import { UnlockDialog } from './UnlockDialog'

// The client shell. It switches views off usePathname() so the same cached "/"
// document can also render deep links offline (the SW navigation fallback). The
// mounted gate defers view rendering to after hydration, so a cached "/" shell
// served for a "/recipe/x" URL doesn't mismatch on the server-rendered markup.
export default function App() {
  const pathname = usePathname()
  const mounted = useIsClient()

  return (
    <div className="rb-root">
      <TopBar />
      {mounted ? <ViewForPath pathname={pathname} /> : null}
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
