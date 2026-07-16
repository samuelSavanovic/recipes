// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
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

afterEach(() => {
  cleanup()
  hardNavigate.mockClear()
  setOnline(true)
  setEffectiveType(undefined)
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
})
