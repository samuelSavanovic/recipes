'use client'

import { useEffect, useState } from 'react'

const SHOW_AFTER_PX = 300

// Floating back-to-top affordance, mounted once in the root layout so it
// covers every route (the client shell only handles the offline path; the
// SSR recipe/new/edit pages never pass through it). Starts hidden, which is
// also the correct SSR state, so there's nothing to hydration-gate — visibility
// is a CSS class toggled off a scroll listener.
export function ScrollTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onScroll() {
      setVisible((prev) => {
        const next = window.scrollY > SHOW_AFTER_PX
        return prev === next ? prev : next
      })
    }
    onScroll() // catch a page already scrolled on mount (e.g. restored position)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollToTop() {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
  }

  return (
    <button
      type="button"
      className={`rb-scrolltop${visible ? ' rb-scrolltop-visible' : ''}`}
      aria-label="Scroll to top"
      // Hidden via opacity/pointer-events (not unmounted, to dodge hydration
      // gating), so a keyboard user could otherwise tab onto an invisible
      // button — pull it out of tab order while hidden.
      tabIndex={visible ? 0 : -1}
      onClick={scrollToTop}
    >
      <span aria-hidden="true">↑</span>
    </button>
  )
}
