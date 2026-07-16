// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { MouseEventHandler, ReactNode } from 'react'

// Stub next/link with a plain anchor so clicks don't require a router context,
// and stub the hard-navigation seam so we can observe it. prefetch is captured
// via a data attribute (rather than spread onto the <a>, which would trigger a
// React DOM-attribute warning for a non-standard boolean prop).
vi.mock('next/link', () => ({
  default: ({
    href,
    onClick,
    children,
    prefetch,
    ...rest
  }: {
    href: string
    onClick?: MouseEventHandler<HTMLAnchorElement>
    children?: ReactNode
    prefetch?: boolean
  }) => (
    <a href={href} onClick={onClick} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}))
const hardNavigate = vi.fn()
vi.mock('@/lib/hard-navigate', () => ({ hardNavigate: (h: string) => hardNavigate(h) }))

// Controllable stand-in for the real router's usePathname, so tests can
// simulate "the navigation settled" by moving this and re-rendering.
let mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

import { AppLink } from './AppLink'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

function setEffectiveType(value: string | undefined) {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: value === undefined ? undefined : { effectiveType: value },
  })
}

// Fake timers for the whole file: AppLink keeps a module-level "navigation
// pending" marker that expires on a timeout, so flushing all timers in
// afterEach resets that guard between tests (module state would otherwise
// leak — every test here clicks the same href).
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.runAllTimers()
  vi.useRealTimers()
  hardNavigate.mockClear()
  setOnline(true)
  setEffectiveType(undefined)
  mockPathname = '/'
})

describe('AppLink', () => {
  it('forces a document navigation on a plain click when offline', () => {
    setOnline(false)
    render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

    const notPrevented = fireEvent.click(screen.getByText('open'))

    expect(hardNavigate).toHaveBeenCalledWith('/recipe/cacio-e-pepe')
    expect(notPrevented).toBe(false) // soft nav suppressed (default prevented)
  })

  it('leaves navigation to the router (soft nav) when online', () => {
    setOnline(true)
    render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

    fireEvent.click(screen.getByText('open'))

    expect(hardNavigate).not.toHaveBeenCalled()
  })

  it('ignores modifier clicks even when offline', () => {
    setOnline(false)
    render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

    fireEvent.click(screen.getByText('open'), { metaKey: true })

    expect(hardNavigate).not.toHaveBeenCalled()
  })

  it.each(['slow-2g', '2g', '3g'])(
    'forces a document navigation when online but the connection is %s',
    (effectiveType) => {
      setOnline(true)
      setEffectiveType(effectiveType)
      render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

      const notPrevented = fireEvent.click(screen.getByText('open'))

      expect(hardNavigate).toHaveBeenCalledWith('/recipe/cacio-e-pepe')
      expect(notPrevented).toBe(false)
    },
  )

  it('leaves navigation to the router when online on a fast (4g) connection', () => {
    setOnline(true)
    setEffectiveType('4g')
    render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

    fireEvent.click(screen.getByText('open'))

    expect(hardNavigate).not.toHaveBeenCalled()
  })

  it('leaves navigation to the router when the Network Information API is unavailable (e.g. Safari)', () => {
    setOnline(true)
    setEffectiveType(undefined)
    render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

    fireEvent.click(screen.getByText('open'))

    expect(hardNavigate).not.toHaveBeenCalled()
  })

  it('disables prefetch by default', () => {
    render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

    expect(screen.getByText('open').getAttribute('data-prefetch')).toEqual('false')
  })

  it('lets a caller opt back into prefetch', () => {
    render(
      <AppLink href="/recipe/cacio-e-pepe" prefetch>
        open
      </AppLink>,
    )

    expect(screen.getByText('open').getAttribute('data-prefetch')).toEqual('true')
  })

  describe('re-click guard', () => {
    it('ignores a repeat click on the same href while the soft navigation is pending', () => {
      setOnline(true)
      render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

      const firstNotPrevented = fireEvent.click(screen.getByText('open'))
      const secondNotPrevented = fireEvent.click(screen.getByText('open'))

      expect(firstNotPrevented).toBe(true) // handed to the router (soft nav)
      expect(secondNotPrevented).toBe(false) // swallowed — no second navigation
      expect(hardNavigate).toHaveBeenCalledTimes(0)
    })

    it('hard-navigates only once for rapid repeat clicks on the same href while offline', () => {
      setOnline(false)
      render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

      fireEvent.click(screen.getByText('open'))
      fireEvent.click(screen.getByText('open'))
      fireEvent.click(screen.getByText('open'))

      expect(hardNavigate).toHaveBeenCalledTimes(1)
      expect(hardNavigate.mock.calls).toEqual([['/recipe/cacio-e-pepe']])
    })

    it('does not block a click to a different href while another href is pending', () => {
      setOnline(false)
      render(
        <>
          <AppLink href="/recipe/cacio-e-pepe">first</AppLink>
          <AppLink href="/recipe/carbonara">second</AppLink>
        </>,
      )

      fireEvent.click(screen.getByText('first'))
      fireEvent.click(screen.getByText('second'))

      expect(hardNavigate).toHaveBeenCalledTimes(2)
      expect(hardNavigate.mock.calls).toEqual([['/recipe/cacio-e-pepe'], ['/recipe/carbonara']])
    })

    it('allows a repeat click on the same href once the pending window has elapsed (hard nav)', () => {
      setOnline(false)
      render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

      fireEvent.click(screen.getByText('open'))
      vi.advanceTimersByTime(3000)
      fireEvent.click(screen.getByText('open'))

      expect(hardNavigate).toHaveBeenCalledTimes(2)
      expect(hardNavigate.mock.calls).toEqual([['/recipe/cacio-e-pepe'], ['/recipe/cacio-e-pepe']])
    })

    it('allows a repeat click on the same href once the pending window has elapsed (soft nav)', () => {
      setOnline(true)
      render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

      const firstNotPrevented = fireEvent.click(screen.getByText('open'))
      vi.advanceTimersByTime(3000)
      const retryNotPrevented = fireEvent.click(screen.getByText('open'))

      expect(firstNotPrevented).toBe(true)
      expect(retryNotPrevented).toBe(true) // guard expired — retry goes to the router
      expect(hardNavigate).toHaveBeenCalledTimes(0)
    })

    it('does not let a modifier click set the guard against a following plain click', () => {
      setOnline(false)
      render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

      fireEvent.click(screen.getByText('open'), { metaKey: true })
      fireEvent.click(screen.getByText('open'))

      expect(hardNavigate).toHaveBeenCalledTimes(1)
      expect(hardNavigate.mock.calls).toEqual([['/recipe/cacio-e-pepe']])
    })

    it('clears the guard as soon as the pathname settles, without waiting for the timeout', () => {
      setOnline(true)
      const { rerender } = render(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

      const firstNotPrevented = fireEvent.click(screen.getByText('open'))

      // Simulate the router having actually completed the navigation.
      mockPathname = '/recipe/cacio-e-pepe'
      rerender(<AppLink href="/recipe/cacio-e-pepe">open</AppLink>)

      const secondNotPrevented = fireEvent.click(screen.getByText('open'))

      expect(firstNotPrevented).toBe(true)
      expect(secondNotPrevented).toBe(true) // settled — a fresh click, not a duplicate
      expect(hardNavigate).not.toHaveBeenCalled()
    })
  })
})
