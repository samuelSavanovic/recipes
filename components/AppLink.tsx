'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { hardNavigate } from '@/lib/hard-navigate'

type AppLinkProps = ComponentProps<typeof Link>

// next/link, but when the browser is offline a plain left-click becomes a full
// document navigation instead of a soft (SPA) navigation. A soft navigation
// fetches RSC data for the target route and fails with no network (Next does not
// fall back to a hard navigation by default). A document navigation instead hits
// the service worker, which serves the cached exact page or the "/" shell — and
// the shell renders the route from IndexedDB. Online, this is a normal <Link>.
export function AppLink({ href, onClick, ...rest }: AppLinkProps) {
  const handleClick: AppLinkProps['onClick'] = (e) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    // Respect modifier/middle clicks (new tab, etc.).
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (
      typeof navigator !== 'undefined' &&
      !navigator.onLine &&
      typeof href === 'string'
    ) {
      e.preventDefault()
      hardNavigate(href)
    }
  }

  return <Link href={href} onClick={handleClick} {...rest} />
}
