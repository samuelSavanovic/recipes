'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { TopBar } from './TopBar'
import { ListView } from './ListView'
import { RecipeView } from './RecipeView'

// The client shell. It switches views off usePathname() so the same cached "/"
// document can also render deep links offline (the SW navigation fallback). The
// mounted gate defers view rendering to after hydration, so a cached "/" shell
// served for a "/recipe/x" URL doesn't mismatch on the server-rendered markup.
export default function App() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
  // Edit routes are wired in a later step; the list is the shell's home and the
  // safe fallback for any other path.
  return <ListView />
}
