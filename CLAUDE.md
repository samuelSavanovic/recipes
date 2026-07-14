# CLAUDE.md — Recipe Book

Conventions for working in this repo. `HANDOFF.md` is the build spec (what to build);
this file is how to build it. When the two conflict, ask.

## Working style

- **Plan first.** Present a plan and get approval before implementing. No large multi-file
  changes without a plan-gate. This is non-negotiable for this repo.
- **Surface findings, don't suppress them.** If you notice a bug, a risk, a bad assumption in
  the spec, or a place where the requested approach will bite later — say so, plainly, before
  proceeding. Don't quietly "fix" things by reinterpreting the request, and don't bury caveats.
  A surfaced concern I decide to ignore is fine; a suppressed one is not.
- **Direct and opinionated.** If there's a clearly better approach, argue for it. Don't hedge
  or offer five options when you have a view. I'll push back if I disagree.
- **No scope creep.** Build what's specified. The non-goals in HANDOFF.md are real (no offline
  writes, no live preview, no OAuth, no custom markdown parser). Don't add "nice to haves"
  unprompted — flag them instead and let me decide.

## Code principles

- **Explicit over implicit / convention.** Prefer mechanical enforcement to relying on
  discipline. If a rule matters, make the tooling enforce it (lint rule, type, assertion) rather
  than a comment asking humans to remember. Boundaries should be walls, not signs.
- **No unnecessary abstraction.** Don't introduce layers, wrappers, or generic machinery for a
  two-editor recipe app. Write the direct version; abstract only when there's real repetition
  with a real reason. YAGNI.
- **TypeScript: no `any` escape hatches.** Type the data model properly. `cook_time` is a
  union type (`'under_15' | '15_30' | '30_60' | 'over_60'`), not a loose string — model it as
  such and let the compiler catch bad values. Prefer `unknown` + narrowing over `any`.
- **Keep the markdown source of truth intact.** `body_md` is stored raw and rendered, never
  round-tripped through a transform that could lose formatting. Don't "normalize" it.
- **Server is the security boundary.** Write endpoints verify the edit token server-side.
  Never trust the client for auth; hiding UI is not access control. (See HANDOFF.md auth.)

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

- **Next.js App Router**, TypeScript. Server components for reads where it helps; the offline
  cache layer is client-side (IndexedDB).
- **Turso / libSQL** via `@libsql/client`. Parameterized queries only — no string-built SQL.
- **Markdown**: `react-markdown` + `remark-gfm`. HTML escaping stays ON — no `rehype-raw`, no
  `dangerouslySetInnerHTML`.
- **PWA / service worker** is the fiddliest surface. Be explicit about the caching strategy
  (app-shell vs API), and about cache invalidation on redeploy — stale-shell-after-deploy is the
  classic failure. Call out your SW strategy in the plan before writing it.

## Commits

- Small, focused commits with clear messages. One concern per commit.
- Don't commit secrets. `EDIT_PASSWORD`, `TURSO_AUTH_TOKEN`, signing secret → env vars only,
  `.env.local` gitignored, `.env.example` committed with placeholder keys.
