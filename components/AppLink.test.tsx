// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { MouseEventHandler, ReactNode } from 'react'

// Stub next/link with a plain anchor so clicks don't require a router context,
// and stub the hard-navigation seam so we can observe it.
vi.mock('next/link', () => ({
  default: ({
    href,
    onClick,
    children,
    ...rest
  }: {
    href: string
    onClick?: MouseEventHandler<HTMLAnchorElement>
    children?: ReactNode
  }) => (
    <a href={href} onClick={onClick} {...rest}>
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

afterEach(() => {
  cleanup()
  hardNavigate.mockClear()
  setOnline(true)
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
})
