# Recipe Book — Build Spec (Claude Code handoff)

A personal recipe collection to replace Notion. Read-heavy, two editors (me + roommate),
family/friends read via shared links. Priorities, in order: **snappy**, **installable PWA
with offline reads**, **owns the format (markdown)**, **dead-simple edit gate**.

This spec captures decisions already made. Follow it as written; where it says "decide,"
use judgment and flag the choice in your plan. **Present a plan and get approval before
implementing** (plan-mode gate).

---

## Stack

- **Next.js (App Router)**, TypeScript.
- **Turso (libSQL)** as the server database. Free tier is plenty (text-only, tens of recipes).
- **IndexedDB** on-device as a local-first read cache (offline reads).
- **PWA**: web manifest + service worker (app-shell caching + offline fallback).
- Deploy target: **Vercel**.
- Markdown rendering: **`react-markdown` + `remark-gfm`** (GFM tables required — see below).

Do NOT hand-roll a markdown parser. The prototype used a custom parser only because the
artifact sandbox can't import packages; production must use react-markdown + remark-gfm,
which correctly handles tables, nested lists, etc. **Copyright/safety note:** react-markdown
escapes HTML by default — keep it that way (no `rehype-raw` / `dangerouslySetInnerHTML`).

---

## Data model

One table. Markdown is the source of truth in `body_md`; never transform or lossily
re-store it.

```sql
CREATE TABLE recipes (
  id          TEXT PRIMARY KEY,      -- slug, e.g. "focaccia-dipping-oil"
  title       TEXT NOT NULL,         -- separate field, NOT parsed from markdown
  cuisine     TEXT NOT NULL DEFAULT '', -- free text, e.g. "Italian"
  cook_time   TEXT NOT NULL,         -- enum: 'under_15' | '15_30' | '30_60' | 'over_60'
  body_md     TEXT NOT NULL DEFAULT '', -- raw markdown, source of truth
  created_at  INTEGER NOT NULL,      -- epoch ms
  updated_at  INTEGER NOT NULL       -- epoch ms
);
CREATE INDEX idx_recipes_cuisine ON recipes(cuisine);
CREATE INDEX idx_recipes_cook_time ON recipes(cook_time);
```

- **Title** is its own field (recipes don't reliably start with an H1).
- **Cuisine** is free text. Show existing cuisines as filter chips (distinct values).
- **cook_time** is a fixed 4-bucket enum. Labels for display:
  - `under_15` → "< 15 min"
  - `15_30` → "15–30 min"
  - `30_60` → "30–60 min"
  - `over_60` → "60+ min"
- Slug generated from title on create; keep stable across edits (don't re-slug on rename,
  to avoid breaking share links). Handle slug collisions (append `-2`, etc.).

---

## Architecture: local-first reads, online-only writes

**Reads (must work offline):**
1. On load, read all recipes from **IndexedDB** → render immediately (instant, offline).
2. In parallel, if online, fetch from the server API → replace IndexedDB contents →
   re-render. ("Eventually fresh," not live — acceptable and expected for this app.)
3. Recipe list and individual recipe views ALWAYS render from the local store.

**Writes (create / edit / delete — online only):**
- Go straight to the server API routes (which write to Turso), then update IndexedDB.
- No offline write queue, no conflict resolution. This is a deliberate simplification the
  requirements allow ("editing on phone can be rough; online is fine"). Do not build CRDT/
  merge logic.

**PWA:**
- `manifest.json` (name, icons, theme colors matching the design tokens below,
  `display: standalone`).
- Service worker caches the app shell (HTML/JS/CSS) for offline open. Network-first or
  stale-while-revalidate for API; cache-first for the shell.
- Must be installable to iOS/Android home screen and open with no network.

---

## Auth — shared edit password, remembered session

Security is intentionally minimal. These are recipes; reads are fully public and NOT gated.
Only **create / edit / delete** are gated.

- One **shared edit password**, stored as an env var on Vercel (e.g. `EDIT_PASSWORD`).
  **Never ship it to the client.**
- The **write API routes verify the password/token server-side.** Gating the UI alone is not
  enough — someone could POST directly, so the lock lives in the API routes. Hiding the edit
  buttons is UX; the server check is the actual security.
- Flow: user enters password once → server verifies → returns a session token → client stores
  it (localStorage is fine here; long-lived, since it only guards editing non-private data) →
  token sent on subsequent write requests. **Do not prompt for the password every time** —
  remembered session is a hard requirement.
- Keep it simple: a signed token (e.g. HMAC of a constant with the secret, or a short JWT)
  is plenty. No user accounts, no GitHub OAuth (dropped by decision).

---

## UI / views

Three views (see the prototype JSX for exact layout and the design system):
1. **List** — page title, count, search-by-title, cuisine filter chips, time-bucket filter
   chips, then a list of recipe rows (title + cuisine tag + time pill). Fully public.
2. **Recipe** — title, cuisine + time tags, rendered markdown body. "Edit" button visible
   only when an edit session is active. Fully public read. Shareable by URL (`/recipe/[slug]`).
3. **Edit** — title field, free-text cuisine input, 4-button time-bucket segmented control,
   plain markdown `<textarea>` (no live preview needed — explicitly not required). Save /
   Cancel / Delete. Gated behind the edit session.

Routing: `/` (list), `/recipe/[slug]` (view), `/edit/[slug]` and `/new` (gated).

---

## Design system (from the approved prototype)

Direction: **cook's procedure-card**, NOT the warm-cream-serif recipe cliché. The recipes are
unusually technical (bloom the herbs, don't scorch the paprika, "common mistakes" tables), so
the design treats a recipe like a lab procedure card. Signature element: **tables and
technique callouts render as bordered field-cards** (dark header bar, bordered).

Tokens (CSS variables from the prototype — reuse exactly):
```
--paper:#efe9dd;  --paper-2:#e7dfcf;  --ink:#241f1a;  --ink-soft:#5c5346;
--line:#c9bda6;   --accent:#3a5a45 (deep herb green);  --hot:#a2432b (paprika, sparingly);
--accent-soft:#dfe6dc;
mono: ui-monospace / JetBrains Mono / Menlo  (metadata, section headers, structure)
serif: Iowan Old Style / Palatino / Georgia  (body, titles)
```
- `##` markdown headers render as uppercase mono section rules in accent green.
- Metadata (cuisine, time, filters) in mono; recipe prose in serif.
- Time bucket = green pill; cuisine = plain bordered tag.
- Must be responsive down to mobile; visible keyboard focus; respect reduced motion.

The prototype JSX (RecipeBook.jsx) has the full component structure, the markdown-to-field-card
rendering, and the complete stylesheet. **Port its look and structure exactly**; swap the custom
parser for react-markdown + remark-gfm, and swap in-memory state for the IndexedDB + Turso layers.

---

## Seed data

Seed the database with this recipe (title: "Focaccia Dipping Oil", cuisine: "Italian",
cook_time: "under_15"). Body markdown:

```markdown
## Ingredients

- 80 ml olive oil
- 3 garlic cloves, smashed (whole, just crushed — easy to fish out)
- ½ tsp dried rosemary
- ½ tsp dried thyme
- ½ tsp dried oregano
- Coarse salt, to taste (or reserve to sprinkle on the focaccia)
- Zest of 1 lemon (optional, off heat)

**Heat, pick one:**

- ¼ tsp ground hot red paprika — *for real, even heat with a faint smoky-sweet depth*, **or**
- Black pepper, to taste — *for aromatic bite without true heat*
- (both is fine)

---

## Critical prep notes

- **Dried herbs need heat to open up** — unlike fresh, they should go into warm oil so they bloom. This is why we gently warm everything instead of just steeping cold.
- **Low and slow, keep it short.** The moment the garlic smells fragrant and just starts to colour, you're done. If garlic browns it turns bitter.
- **Ground paprika burns faster than flakes.** Add it with the other spices, off the boil, and never let it scorch — burnt paprika goes bitter fast. If it's a pure-hot paprika, start light.
- **Lemon zest goes in off the heat** — heat kills its fresh top note.
- **Let the oil cool to lukewarm before dipping.** Hot oil dulls the spice nuance on the palate.
- **Coarse salt:** either stir into the oil, or (better) sprinkle directly on the warm focaccia before dipping so you get an unmelted crunch of salt.

---

## Steps

### Cooking

1. Put the olive oil and smashed garlic in a small pan over low heat. Warm until the garlic just begins to sizzle (~1 min).
2. Add the rosemary, thyme, oregano, and your chosen heat (paprika or pepper). Warm gently until the garlic is fragrant and just tinged with colour — do not let it brown (~2–3 min).
3. Off the heat: fish out the garlic cloves. Grate in the lemon zest if using. Let cool to lukewarm before dipping.

---

## Common mistakes

| Mistake | Result | Fix |
| --- | --- | --- |
| Oil too hot / garlic browns | Bitter, acrid oil | Low heat, pull the moment garlic smells good |
| Paprika added too early / scorched | Bitter, muddy | Add off the boil, keep heat gentle, start light if pure-hot |
| Lemon zest added on heat | Loses fresh aroma | Always zest in off the heat |
| Dipping while oil is hot | Spice nuance flattened on the palate | Cool to lukewarm first |
| Salt fully dissolved in oil | No textural pop | Sprinkle coarse salt on the focaccia instead |

---

## Notes

- **Gouda on the side:** semi-hard, mildly nutty and sweet — leans nicely against the aromatic oil. Young Gouda is creamier; aged Gouda's caramel note holds up even better against the garlic and herbs.
- **Cheesier version:** grate a little pecorino or parmesan into the lukewarm oil at the end for a thicker, saltier, near-sauce.
- **Keeps** a couple of days in the fridge — remove the garlic first so it doesn't ferment. Bring back to lukewarm before serving.
- **Paprika vs. pepper vs. flakes:** flakes = intermittent stabs of heat; ground paprika = even, milder warmth with depth; black pepper = aromatic sharpness, no real heat. Mix to taste.
```

---

## Build order (suggested)

1. Scaffold Next.js (App Router, TS). Design tokens + global styles from the prototype.
2. Turso: schema migration, client (`@libsql/client`), seed the recipe above.
3. API routes: `GET` recipes (public), `POST`/`PUT`/`DELETE` (password-gated, server-verified).
4. List + Recipe views, reading from IndexedDB with background server refresh.
5. react-markdown + remark-gfm renderer, styled to match the prototype's field-card look.
6. Edit/new views + the shared-password session (remembered).
7. PWA: manifest, service worker, app-shell caching, offline verification.
8. Deploy to Vercel; set `TURSO_*` and `EDIT_PASSWORD` env vars.

## Env vars
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `EDIT_PASSWORD` (server-side only), plus a secret for signing the session token.

## Explicit non-goals (do not build)
- No live preview in the editor.
- No offline writes / sync queue / conflict resolution.
- No private reads / per-user accounts / OAuth.
- No custom markdown parser.
