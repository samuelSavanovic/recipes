'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { TopBar } from './TopBar'
import { ListView } from './ListView'

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
  // Recipe and edit routes are wired in later; the list is the shell's home and
  // the safe fallback for any other path.
  void pathname
  return <ListView />
}
