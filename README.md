# mise — recipe book

A personal recipe PWA that replaces Notion. Read-heavy, two editors, family/friends read via
shared links. Priorities, in order: **snappy**, **installable PWA with offline reads**, **owns
the format (markdown)**, **dead-simple edit gate**.

The design is a cook's **procedure-card**: tables and technique callouts render as bordered
field-cards, metadata in mono, prose in serif.

## Stack

- **Next.js 16 (App Router)** + TypeScript
- **Turso / libSQL** (`@libsql/client`) — one table, markdown is the source of truth
- **IndexedDB** on-device read cache (offline reads)
- **PWA**: web manifest + hand-written service worker
- **Markdown**: `react-markdown` + `remark-gfm` (HTML escaping stays on — no `rehype-raw`)

## Architecture

**Reads — local-first.** On load the client reads all recipes from IndexedDB and renders
immediately; in parallel, if online, it fetches `GET /api/recipes`, replaces IndexedDB, and
re-renders ("eventually fresh"). The list (`/`) is client/IDB-first.

**Recipe pages — hybrid.** `/recipe/[slug]` is a **server component**: it fetches from the DB
and renders title/meta/markdown server-side with `generateMetadata` (recipe title on shared
links), so first-time visitors get content in the first response. Offline, the service worker
serves the cached exact-URL HTML if the recipe was visited before, else the `/` shell, which
re-renders the route from IndexedDB after mount.

**Writes — online-only.** Create/edit/delete go straight to the API with
`Authorization: Bearer <token>`, then patch IndexedDB + state. No offline write queue, no
conflict resolution (a deliberate simplification).

**Auth.** One shared edit password. `POST /api/auth` verifies it and returns a long-lived token
= `hex(HMAC-SHA256(SESSION_SECRET, "recipes-edit-v1"))`. The **write API routes verify the
token server-side** — hiding the edit UI is only UX. Revoke everyone by rotating
`SESSION_SECRET`. Password and token comparisons are constant-time.

**PWA.** `sw/sw.js` (hand-written, no workbox) precaches the app shell + icons; navigations are
network-first with an offline fallback (exact URL → `/` shell); immutable assets are
cache-first; the API is network-first. `scripts/stamp-sw.mjs` stamps a per-build `VERSION`
(git hash + mtime) into `public/sw.js` on `prebuild`/`predev`, so each deploy ships a
byte-different SW that reinstalls and purges old caches. The SW registers in **production only**
(it would fight HMR in dev).

## Getting started

Toolchain is pinned with [mise](https://mise.jdx.dev) (`.mise.toml`, Node 22).

```bash
mise install            # Node 22
npm install

cp .env.example .env.local   # then edit — local dev needs only:
#   EDIT_PASSWORD=...          the shared edit password
#   SESSION_SECRET=...         a long random string (signs the edit token)
# With TURSO_* unset, the DB falls back to a local file:local.db.

npm run db:setup        # create the schema (idempotent)
npm run db:import       # import notion_export/ → DB (44 recipes; empty template skipped)

npm run dev             # http://localhost:3000
```

To rebuild the PWA icons from the ◍ mark: `npm run gen:icons` (committed PNGs).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (stamps the SW first) |
| `npm run build` / `npm start` | Production build (stamps the SW) / serve |
| `npm test` | Vitest suite |
| `npm run lint` | ESLint |
| `npm run db:setup` | Create the schema (idempotent) |
| `npm run db:import` | Import the Notion export (`-- --force` replaces all) |
| `npm run gen:icons` | Regenerate PWA icons |

## Data import

`scripts/import-notion.ts` treats the `notion_export/Recipes/*.md` files as the source of truth
(title from the H1, metadata from the property block, body kept verbatim) and cross-checks every
file against the `*_all.csv` — any disagreement is a loud exit. The empty `Recipe` template is
the one expected skip. Cleaning: `Japanise → Japanese`; `Last cooked` dropped; time buckets map
`<30min → 15_30`, `<60min → 30_60`, `>60min → over_60` (`under_15` starts unused).

The import prints a **time-bucket report** (the `15–30 min` group first) so genuinely-quick
recipes coarsened by the `<30min → 15_30` mapping can be spotted and hand-fixed to `< 15 min`
in the editor afterward. The script surfaces; it does not guess.

`notion_export/` and `local.db` are gitignored — the DB is the store of record.

## Testing

Vitest (Node default; jsdom per-file for component tests), RTL, `fake-indexeddb`, and an
in-memory libSQL (`:memory:`) for DB/API tests. Coverage: slug generation + collisions, API
auth/validation/shape (server boundary, exercised directly with `Request` objects), pure
filtering, the offline read path (IndexedDB hit with the network down), markdown rendering
(GFM table field-cards, nested lists, HTML escaping), the Notion parser (exact shape incl.
`main`), and `main` end-to-end through the editor.

## Deploy (Vercel + Turso)

Deploy is documented, not yet executed.

1. **Turso**: create a database and get its URL + auth token.
   ```bash
   turso db create recipe-book
   turso db show recipe-book --url        # → TURSO_DATABASE_URL
   turso db tokens create recipe-book     # → TURSO_AUTH_TOKEN
   ```
2. **Schema + data** against Turso: set `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` in
   `.env.local`, then `npm run db:setup` and `npm run db:import`.
3. **Vercel**: import the repo and set env vars **TURSO_DATABASE_URL**, **TURSO_AUTH_TOKEN**,
   **EDIT_PASSWORD**, **SESSION_SECRET**. Deploy. `prebuild` stamps the SW during the Vercel
   build; redeploys automatically invalidate old SW caches.

## Non-goals

No live preview, no offline writes / sync queue / conflict resolution, no per-user accounts /
OAuth, no custom markdown parser.
