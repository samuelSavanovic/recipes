# CLAUDE.md — Recipe Book (mise)

How to work in this repo. It's a **built and deployed** personal recipe PWA: Next.js App Router
+ TypeScript, Turso/libSQL, an IndexedDB offline read cache, and a hand-written service worker.
See `README.md` for architecture, local setup, and deployment. The app **auto-deploys to Vercel
on push to `main`**.

## Working style

- **Surface findings, don't suppress them.** If you notice a bug, a risk, a bad assumption, or a
  place where the requested approach will bite later — say so, plainly, before proceeding. Don't
  quietly "fix" things by reinterpreting the request, and don't bury caveats. A surfaced concern
  I decide to ignore is fine; a suppressed one is not.
- **Direct and opinionated.** If there's a clearly better approach, argue for it. Don't hedge or
  offer five options when you have a view. I'll push back if I disagree.
- **Plan non-trivial changes.** For work that touches many files, public APIs, or the
  service-worker / DB boundary, outline the approach before implementing. Small, reversible edits:
  just do them.
- **No scope creep.** The non-goals are real: no offline writes / sync queue / conflict
  resolution, no side-by-side live preview in the editor, no per-user accounts / OAuth, no
  custom markdown parser. Flag "nice to haves" instead of building them.
  - The editor's Write/Preview tabs are the whole of the preview story: a click to switch, and
    the panel renders through the same `RecipeMarkdown` as the recipe page. A split pane that
    re-renders as you type is still a non-goal — it buys little on a phone and is the version
    that grows scroll-sync and debounce machinery.

## Code principles

- **Explicit over implicit / convention.** Prefer mechanical enforcement to relying on
  discipline. If a rule matters, make the tooling enforce it (lint rule, type, assertion) rather
  than a comment asking humans to remember. Boundaries should be walls, not signs.
- **No unnecessary abstraction.** Don't introduce layers, wrappers, or generic machinery for a
  two-editor recipe app. Write the direct version; abstract only when there's real repetition
  with a real reason. YAGNI.
- **TypeScript: no `any` escape hatches.** Keep the data model typed. `cook_time` is a union
  (`'under_15' | '15_30' | '30_60' | 'over_60'`), not a loose string — let the compiler catch bad
  values. Prefer `unknown` + narrowing over `any`.
- **Keep the markdown source of truth intact.** `body_md` is stored raw and rendered, never
  round-tripped through a transform that could lose formatting. Don't "normalize" it.
- **Server is the security boundary.** Write endpoints verify the edit token server-side. Never
  trust the client for auth; hiding UI is not access control.

## Testing

- **Exact assertions.** Use `toEqual`, not `toMatchObject`. Assert the whole shape, not a
  convenient subset — partial matchers hide regressions in the fields you didn't spell out.
- **Test behavior, not implementation.** Cover the things that would actually break in use:
  filtering by cuisine/time, slug generation + collision handling, the offline-read path
  (IndexedDB hit when the network is down), write-auth rejection when the token is missing/wrong,
  and markdown rendering of the hard cases (GFM tables, nested lists).
- **Real assertions on error paths.** A rejected write should assert the status/behavior, not
  just "doesn't throw." Match on the actual failure, not a vague catch.
- **No trivially-passing tests.** If a test would pass against a broken implementation, it's not
  earning its place. When in doubt, sanity-check that the test fails when the behavior is wrong.

## Stack-specific

- **Next.js 16 (App Router)**, TypeScript. Dynamic-route `params` and route-handler context are
  async — `await params`. Recipe pages are SSR (`export const dynamic = 'force-dynamic'`); the
  list and offline views are client / IndexedDB-first.
- **Turso / libSQL** via `@libsql/client`. Parameterized queries only — no string-built SQL.
  Local dev falls back to `file:local.db` when `TURSO_*` is unset; tests use `:memory:`.
- **Markdown**: `react-markdown` + `remark-gfm`. HTML escaping stays ON — no `rehype-raw`, no
  `dangerouslySetInnerHTML`.
- **PWA / service worker** is the fiddliest surface. `sw/sw.js` is hand-written and
  version-stamped into `public/sw.js` at build (`prebuild`/`predev`). Be explicit about the
  caching strategy (app-shell vs API) and cache invalidation on redeploy — stale-shell-after-deploy
  is the classic failure. It registers in production only.

## Commits

- Small, focused commits with clear messages. One concern per commit.
- Don't commit secrets. `EDIT_PASSWORD`, `SESSION_SECRET`, `TURSO_AUTH_TOKEN` → env vars only
  (`.env.local` local, Vercel project for production). `.env.local` is gitignored; `.env.example`
  is committed with placeholders.
