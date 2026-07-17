'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, type ComponentProps } from 'react'
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

// Re-click guard: the App Router neither cancels nor dedupes an in-flight soft
// navigation, so tapping the same recipe card again while the first tap's RSC
// fetch is still pending fires a brand-new identical request each time — on a
// slow connection that piles up fast. Module-level on purpose — the duplicate
// request is per-URL, so two different links to the same recipe share one
// guard. A single slot (not a map) is enough: clicking a *different* href is a
// new intent and simply replaces the pending one.
//
// Cleared two ways:
// - As soon as the pathname actually changes (below, via usePathname): once
//   the URL has moved to wherever the click was headed, that navigation has
//   settled (successfully or not), so a fresh click is a new intent, not a
//   duplicate. This is what makes "open a recipe, go back, open it again"
//   work immediately instead of waiting out the window below.
// - A 3s timeout backstop, for when nothing renders a settled pathname back
//   at us — e.g. the fetch is still genuinely hung. Long enough that
//   impatient double/triple taps land well inside it, short enough that it
//   can never leave the link stuck for more than a few seconds if a
//   navigation silently dies.
const PENDING_NAVIGATION_WINDOW_MS = 3000
let pendingHref: string | null = null
let pendingTimer: ReturnType<typeof setTimeout> | undefined

function clearPendingNavigation() {
  pendingHref = null
  clearTimeout(pendingTimer)
  pendingTimer = undefined
}

function beginPendingNavigation(href: string) {
  pendingHref = href
  clearTimeout(pendingTimer)
  pendingTimer = setTimeout(clearPendingNavigation, PENDING_NAVIGATION_WINDOW_MS)
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
  // See the re-click guard comment above: a pathname change means whatever
  // navigation was pending has settled, so clear the guard right away instead
  // of waiting out the timeout backstop.
  const pathname = usePathname()
  // Skip the first run: it fires on mount (e.g. a card list re-rendering
  // after a click, virtualization bringing a link back), not on an actual
  // pathname transition, and would wipe a guard set moments ago by the very
  // click this instance is meant to be tracking.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    clearPendingNavigation()
  }, [pathname])

  const handleClick: AppLinkProps['onClick'] = (e) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    // Respect modifier/middle clicks (new tab, etc.) — a new-tab open is not
    // "the same navigation intent", so it neither checks nor sets the guard.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    // Offline/slow goes straight to a hard navigation and never touches the
    // re-click guard: a hard navigation tears down the document, so
    // usePathname never fires to clear it, and the 3s timeout backstop would
    // be racing a page that's being destroyed anyway. The browser's own
    // loading state is the feedback here, not this guard.
    if (
      typeof navigator !== 'undefined' &&
      (!navigator.onLine || isSlowConnection()) &&
      typeof href === 'string'
    ) {
      e.preventDefault()
      hardNavigate(href)
      return
    }
    // Object-form hrefs skip the guard; this app only ever passes string hrefs.
    if (typeof href === 'string') {
      if (pendingHref === href) {
        // Same href clicked again while its navigation is still pending:
        // swallow the click instead of firing another identical request.
        e.preventDefault()
        return
      }
      beginPendingNavigation(href)
    }
  }

  return <Link href={href} onClick={handleClick} prefetch={prefetch} {...rest} />
}
