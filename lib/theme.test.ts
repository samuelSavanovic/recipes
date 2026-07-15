// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  THEME_COLOR,
  THEME_KEY,
  THEME_BOOTSTRAP_SCRIPT,
  applyTheme,
  isTheme,
  nextTheme,
  readTheme,
  subscribeTheme,
  writeTheme,
} from './theme'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  // The localStorage-failure tests spy on Storage.prototype; without this the
  // mock leaks into every later test in the file.
  vi.restoreAllMocks()
})

describe('readTheme', () => {
  it('defaults to system when nothing is stored', () => {
    expect(readTheme()).toEqual('system')
  })

  it('reads a stored preference back', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    expect(readTheme()).toEqual('dark')
  })

  it('falls back to system on a value outside the union', () => {
    // e.g. a hand-edited key, or a value from a future version.
    localStorage.setItem(THEME_KEY, 'solarized')
    expect(readTheme()).toEqual('system')
  })

  it('falls back to system when localStorage throws (Safari private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readTheme()).toEqual('system')
  })
})

describe('isTheme', () => {
  it('accepts every member of the union and rejects other values', () => {
    expect(['system', 'light', 'dark'].every(isTheme)).toEqual(true)
    expect([null, undefined, '', 'System', 'auto', 0].some(isTheme)).toEqual(
      false,
    )
  })
})

describe('nextTheme', () => {
  it('cycles system → light → dark and wraps back to system', () => {
    expect(nextTheme('system')).toEqual('light')
    expect(nextTheme('light')).toEqual('dark')
    expect(nextTheme('dark')).toEqual('system')
  })
})

describe('applyTheme', () => {
  it('stamps an explicit preference onto <html>', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toEqual('dark')
  })

  // 'system' must be the *absence* of the attribute, so that the CSS
  // :root:not([data-theme='light']) branch matches under the dark media query.
  it('removes the attribute for system rather than writing "system"', () => {
    applyTheme('dark')
    applyTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toEqual(false)
  })
})

describe('writeTheme', () => {
  it('persists the preference and applies it in one step', () => {
    writeTheme('light')
    expect(localStorage.getItem(THEME_KEY)).toEqual('light')
    expect(document.documentElement.dataset.theme).toEqual('light')
  })

  it('still applies the theme when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    writeTheme('dark')
    // The choice won't survive a reload, but it must still take effect now.
    expect(document.documentElement.dataset.theme).toEqual('dark')
  })

  it('notifies subscribers', () => {
    const callback = vi.fn()
    const unsubscribe = subscribeTheme(callback)
    writeTheme('dark')
    expect(callback).toHaveBeenCalledTimes(1)
    unsubscribe()
    writeTheme('light')
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

describe('subscribeTheme cross-tab sync', () => {
  it('re-applies the attribute when another tab changes the theme', () => {
    const callback = vi.fn()
    const unsubscribe = subscribeTheme(callback)

    // Another tab wrote localStorage; this document's <html> is still stale.
    localStorage.setItem(THEME_KEY, 'dark')
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY }))

    expect(document.documentElement.dataset.theme).toEqual('dark')
    expect(callback).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('ignores storage events for unrelated keys', () => {
    const callback = vi.fn()
    const unsubscribe = subscribeTheme(callback)

    localStorage.setItem('recipe-edit-token', 'abc')
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'recipe-edit-token' }),
    )

    expect(callback).not.toHaveBeenCalled()
    unsubscribe()
  })
})

describe('THEME_BOOTSTRAP_SCRIPT', () => {
  // It runs as a raw <script> in <head> before React exists, so it can only be
  // exercised by evaluating it the way the browser does.
  function runBootstrap(): void {
    new Function(THEME_BOOTSTRAP_SCRIPT)()
  }

  it('stamps a stored explicit preference onto <html> before paint', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    runBootstrap()
    expect(document.documentElement.dataset.theme).toEqual('dark')
  })

  it('leaves the attribute off for system, matching applyTheme', () => {
    localStorage.setItem(THEME_KEY, 'system')
    runBootstrap()
    expect(document.documentElement.hasAttribute('data-theme')).toEqual(false)
  })

  it('leaves the attribute off for an unstored or bogus preference', () => {
    runBootstrap()
    expect(document.documentElement.hasAttribute('data-theme')).toEqual(false)

    localStorage.setItem(THEME_KEY, 'solarized')
    runBootstrap()
    expect(document.documentElement.hasAttribute('data-theme')).toEqual(false)
  })

  it('does not throw when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => runBootstrap()).not.toThrow()
  })

  it('reads the same key the module writes', () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(THEME_KEY))
  })
})

// globals.css is the source of truth for colour, but two things must mirror it
// and cannot read it: the <meta name="theme-color"> tint, and the dark token
// list, which is spelled twice (once per dark selector). Both rot silently.
describe('globals.css token drift', () => {
  // Resolved from cwd, not import.meta.url: this file runs under jsdom, where
  // import.meta.url is an http: URL rather than a file: one.
  const css = readFileSync(
    join(process.cwd(), 'app/globals.css'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '') // comments would confuse the token regex

  function tokensOf(selector: string): Record<string, string> {
    const at = css.indexOf(selector)
    if (at === -1) throw new Error(`selector not found in globals.css: ${selector}`)
    const open = css.indexOf('{', at)
    const body = css.slice(open + 1, css.indexOf('}', open))
    return Object.fromEntries(
      [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [
        m[1],
        m[2].trim(),
      ]),
    )
  }

  const light = tokensOf(':root {')
  const systemDark = tokensOf(":root:not([data-theme='light'])")
  const forcedDark = tokensOf(":root[data-theme='dark']")

  it('keeps the light theme-color meta in step with --paper', () => {
    expect(light['--paper']).toEqual(THEME_COLOR.light)
  })

  it('keeps the dark theme-color meta in step with --paper', () => {
    expect(forcedDark['--paper']).toEqual(THEME_COLOR.dark)
  })

  // The OS-dark and forced-dark selectors must stay byte-identical, or forcing
  // dark would render differently from the OS switching to dark.
  it('defines identical tokens for OS-dark and forced-dark', () => {
    expect(systemDark).toEqual(forcedDark)
  })

  // A token defined in light but missing from dark silently keeps its light
  // value at night — the exact bug --ink-faint was introduced to fix.
  it('overrides every light colour token in dark mode', () => {
    const colourTokens = Object.keys(light).filter(
      (t) => !['--mono', '--serif'].includes(t),
    )
    expect(Object.keys(forcedDark).sort()).toEqual(colourTokens.sort())
  })
})
