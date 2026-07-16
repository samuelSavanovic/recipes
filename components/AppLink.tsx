'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { hardNavigate } from '@/lib/hard-navigate'

type AppLinkProps = ComponentProps<typeof Link>

// Not in TypeScript's DOM lib — the Network Information API is Chromium-only
// (no Safari/iOS), so navigator.connection is undefined there and isSlowConnection
// falls through to false, leaving AppLink's online behavior unchanged on iOS.
interface NetworkInformation {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g'
}
interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation
}

// effectiveType is a measured-quality estimate (recent round-trip time and
// throughput), not the radio technology — a congested or weak-signal 5G link
// that behaves badly gets bucketed as '2g'/'3g' same as an actual 2G/3G radio.
const SLOW_EFFECTIVE_TYPES = new Set(['slow-2g', '2g', '3g'])

function isSlowConnection(): boolean {
  const connection = (navigator as NavigatorWithConnection).connection
  return connection?.effectiveType !== undefined && SLOW_EFFECTIVE_TYPES.has(connection.effectiveType)
}

// next/link, but a plain left-click becomes a full document navigation instead
// of a soft (SPA) navigation when the browser is offline OR the connection is
// detected as slow. A soft navigation always fetches fresh RSC data for the
// target route: with no network that fetch fails outright (Next does not fall
// back to a hard navigation by default), and on a slow-but-connected network it
// just hangs, blocking on the round trip even though the recipe is already
// sitting in the local store. A document navigation instead hits the service
// worker, which serves the cached exact page or the "/" shell — and the shell
// renders the route from IndexedDB, instantly either way. On a good connection
// this is a normal <Link>, unchanged.
//
// prefetch defaults to false (Link's own default is "auto"): our routes are
// force-dynamic, and Next's App Router client cache uses staleTime: 0 for
// dynamic routes, so an auto-prefetched link never gets to reuse its own
// fetch — every viewport-enter/exit re-fires it. With many recipe cards on
// screen, that's a fresh fetch per card per scroll, none of them cancelled,
// piling up indefinitely on a slow connection. Nothing here benefits from
// speculative prefetch, so it's off unless a caller opts back in.
export function AppLink({ href, onClick, prefetch = false, ...rest }: AppLinkProps) {
  const handleClick: AppLinkProps['onClick'] = (e) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    // Respect modifier/middle clicks (new tab, etc.).
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (
      typeof navigator !== 'undefined' &&
      (!navigator.onLine || isSlowConnection()) &&
      typeof href === 'string'
    ) {
      e.preventDefault()
      hardNavigate(href)
    }
  }

  return <Link href={href} onClick={handleClick} prefetch={prefetch} {...rest} />
}
