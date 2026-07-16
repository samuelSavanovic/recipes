// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ScrollTopButton } from './ScrollTopButton'

// jsdom has no layout engine, so window.scrollY is a plain writable property
// here (real browsers treat it as read-only, driven by actual scrolling).
function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true })
}

beforeEach(() => {
  setScrollY(0)
  // jsdom does not implement matchMedia at all.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ScrollTopButton', () => {
  it('is hidden at the top of the page', () => {
    render(<ScrollTopButton />)

    const button = screen.getByRole('button', { name: 'Scroll to top' })
    expect(button.className).toEqual('rb-scrolltop')
  })

  it('becomes visible once scrolled past the threshold', () => {
    render(<ScrollTopButton />)
    const button = screen.getByRole('button', { name: 'Scroll to top' })

    setScrollY(400)
    fireEvent.scroll(window)

    expect(button.className).toEqual('rb-scrolltop rb-scrolltop-visible')
  })

  it('hides again after scrolling back to the top', () => {
    render(<ScrollTopButton />)
    const button = screen.getByRole('button', { name: 'Scroll to top' })

    setScrollY(400)
    fireEvent.scroll(window)
    expect(button.className).toEqual('rb-scrolltop rb-scrolltop-visible')

    setScrollY(0)
    fireEvent.scroll(window)

    expect(button.className).toEqual('rb-scrolltop')
  })

  it('scrolls smoothly to the top on click', () => {
    setScrollY(400)
    render(<ScrollTopButton />)
    fireEvent.scroll(window)
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)

    fireEvent.click(screen.getByRole('button', { name: 'Scroll to top' }))

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('jumps instantly to the top when the user prefers reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    )
    setScrollY(400)
    render(<ScrollTopButton />)
    fireEvent.scroll(window)
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)

    fireEvent.click(screen.getByRole('button', { name: 'Scroll to top' }))

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('picks up an already-scrolled position on mount', () => {
    setScrollY(400)

    render(<ScrollTopButton />)

    expect(screen.getByRole('button', { name: 'Scroll to top' }).className).toEqual(
      'rb-scrolltop rb-scrolltop-visible',
    )
  })
})
