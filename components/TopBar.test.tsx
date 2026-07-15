// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// AppLink renders next/link; TopBar itself needs no router, but the mock keeps
// the component tree self-contained (same shape as tests/offline-read.test.tsx).
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

import { RecipesProvider } from '@/lib/store'
import { TopBar } from './TopBar'
import { THEME_KEY } from '@/lib/theme'

// Never assert computed colours here: jsdom does not evaluate @media or
// prefers-color-scheme, so the only observable effects are the attribute on
// <html> and the persisted preference.
function renderTopBar() {
  return render(
    <RecipesProvider>
      <TopBar />
    </RecipesProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('TopBar theme toggle', () => {
  it('starts on auto, with the attribute left off so CSS follows the OS', async () => {
    renderTopBar()

    expect(await screen.findByRole('button', { name: /^Theme: auto/ })).toBeInTheDocument()
    expect(document.documentElement.hasAttribute('data-theme')).toEqual(false)
  })

  it('cycles auto → light → dark → auto, persisting and applying each step', async () => {
    renderTopBar()

    const toggle = await screen.findByRole('button', { name: /^Theme:/ })

    fireEvent.click(toggle)
    expect(document.documentElement.dataset.theme).toEqual('light')
    expect(localStorage.getItem(THEME_KEY)).toEqual('light')
    expect(toggle).toHaveTextContent('light')

    fireEvent.click(toggle)
    expect(document.documentElement.dataset.theme).toEqual('dark')
    expect(localStorage.getItem(THEME_KEY)).toEqual('dark')
    expect(toggle).toHaveTextContent('dark')

    fireEvent.click(toggle)
    // Back to auto: the attribute must come off, not read "system", or the CSS
    // :root:not([data-theme='light']) branch would stop tracking the OS.
    expect(document.documentElement.hasAttribute('data-theme')).toEqual(false)
    expect(localStorage.getItem(THEME_KEY)).toEqual('system')
    expect(toggle).toHaveTextContent('auto')
  })

  it('renders the stored preference on mount', async () => {
    localStorage.setItem(THEME_KEY, 'dark')
    renderTopBar()

    expect(
      await screen.findByRole('button', { name: 'Theme: dark. Switch to auto.' }),
    ).toBeInTheDocument()
  })

  it('announces the current theme and the next one', async () => {
    renderTopBar()

    const toggle = await screen.findByRole('button', { name: /^Theme:/ })
    expect(toggle).toHaveAccessibleName('Theme: auto. Switch to light.')

    fireEvent.click(toggle)
    expect(toggle).toHaveAccessibleName('Theme: light. Switch to dark.')
  })
})
