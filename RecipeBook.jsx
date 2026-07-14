import React, { useState, useMemo } from "react";

// ---------------------------------------------------------------------------
// Recipe book prototype
// In-memory only. This is the UI + data shape made tangible before wiring to
// Turso/libSQL. The markdown renderer here is a compact purpose-built parser
// covering exactly what the recipes use (headers, bold/italic, lists, tables,
// hr, blockquotes, inline code). In the real app this swaps for
// react-markdown + remark-gfm.
// ---------------------------------------------------------------------------

const BUCKETS = [
  { id: "under_15", label: "< 15 min" },
  { id: "15_30", label: "15–30 min" },
  { id: "30_60", label: "30–60 min" },
  { id: "over_60", label: "60+ min" },
];
const bucketLabel = (id) => BUCKETS.find((b) => b.id === id)?.label ?? "—";

const SEED = [
  {
    id: "focaccia-dipping-oil",
    title: "Focaccia Dipping Oil",
    cuisine: "Italian",
    cook_time: "under_15",
    body_md: `## Ingredients

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
- **Paprika vs. pepper vs. flakes:** flakes = intermittent stabs of heat; ground paprika = even, milder warmth with depth; black pepper = aromatic sharpness, no real heat. Mix to taste.`,
  },
];

// ---------------------------------------------------------------------------
// Minimal markdown renderer
// ---------------------------------------------------------------------------

function renderInline(text) {
  // Order matters: bold before italic. Uses a token walk to avoid regex nesting bugs.
  const nodes = [];
  let remaining = text;
  let key = 0;
  const patterns = [
    { re: /\*\*([^*]+)\*\*/, tag: "strong" },
    { re: /\*([^*]+)\*/, tag: "em" },
    { re: /`([^`]+)`/, tag: "code" },
  ];
  while (remaining.length) {
    let earliest = null;
    for (const p of patterns) {
      const m = p.re.exec(remaining);
      if (m && (earliest === null || m.index < earliest.index)) {
        earliest = { ...p, match: m, index: m.index };
      }
    }
    if (!earliest) {
      nodes.push(remaining);
      break;
    }
    if (earliest.index > 0) nodes.push(remaining.slice(0, earliest.index));
    const inner = earliest.match[1];
    const Tag = earliest.tag;
    if (Tag === "code") {
      nodes.push(<code className="rb-code" key={key++}>{inner}</code>);
    } else if (Tag === "strong") {
      nodes.push(<strong key={key++}>{renderInline(inner)}</strong>);
    } else {
      nodes.push(<em key={key++}>{renderInline(inner)}</em>);
    }
    remaining = remaining.slice(earliest.index + earliest.match[0].length);
  }
  return nodes;
}

function Markdown({ src }) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  let key = 0;

  const flushList = (items, ordered) => {
    const ListTag = ordered ? "ol" : "ul";
    blocks.push(
      <ListTag className="rb-list" key={key++}>
        {items.map((it, idx) => (
          <li key={idx}>{renderInline(it)}</li>
        ))}
      </ListTag>
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    // blank
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // horizontal rule
    if (/^---+\s*$/.test(line)) {
      blocks.push(<hr className="rb-hr" key={key++} />);
      i++;
      continue;
    }

    // headers
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const Tag = `h${Math.min(level + 1, 6)}`; // shift down; page title is the h1
      blocks.push(
        <Tag className={`rb-h rb-h${level}`} key={key++}>
          {renderInline(h[2])}
        </Tag>
      );
      i++;
      continue;
    }

    // table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = line.split("|").slice(1, -1).map((c) => c.trim());
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      blocks.push(
        <div className="rb-table-wrap" key={key++}>
          <table className="rb-table">
            <thead>
              <tr>{header.map((c, idx) => <th key={idx}>{renderInline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci}>{renderInline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      flushList(items, false);
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      flushList(items, true);
      continue;
    }

    // paragraph (gather until blank)
    const para = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|---+\s*$|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p className="rb-p" key={key++}>
        {renderInline(para.join(" "))}
      </p>
    );
  }

  return <div className="rb-md">{blocks}</div>;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);

export default function RecipeBook() {
  const [recipes, setRecipes] = useState(SEED);
  const [view, setView] = useState({ name: "list" }); // list | recipe | edit
  const [cuisineFilter, setCuisineFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [q, setQ] = useState("");

  const cuisines = useMemo(
    () => [...new Set(recipes.map((r) => r.cuisine).filter(Boolean))].sort(),
    [recipes]
  );

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (cuisineFilter && r.cuisine !== cuisineFilter) return false;
      if (timeFilter && r.cook_time !== timeFilter) return false;
      if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [recipes, cuisineFilter, timeFilter, q]);

  const current = view.id ? recipes.find((r) => r.id === view.id) : null;

  const saveRecipe = (draft) => {
    setRecipes((prev) => {
      const exists = prev.some((r) => r.id === draft.id);
      return exists ? prev.map((r) => (r.id === draft.id ? draft : r)) : [...prev, draft];
    });
    setView({ name: "recipe", id: draft.id });
  };

  const deleteRecipe = (id) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setView({ name: "list" });
  };

  return (
    <div className="rb-root">
      <style>{CSS}</style>

      <header className="rb-topbar">
        <button className="rb-brand" onClick={() => setView({ name: "list" })}>
          <span className="rb-brand-mark">◍</span>
          <span className="rb-brand-name">mise</span>
          <span className="rb-brand-sub">recipe book</span>
        </button>
        <button
          className="rb-btn rb-btn-primary"
          onClick={() => setView({ name: "edit", id: null })}
        >
          + New recipe
        </button>
      </header>

      {view.name === "list" && (
        <ListView
          recipes={filtered}
          all={recipes}
          cuisines={cuisines}
          cuisineFilter={cuisineFilter}
          setCuisineFilter={setCuisineFilter}
          timeFilter={timeFilter}
          setTimeFilter={setTimeFilter}
          q={q}
          setQ={setQ}
          open={(id) => setView({ name: "recipe", id })}
        />
      )}

      {view.name === "recipe" && current && (
        <RecipeView
          recipe={current}
          onBack={() => setView({ name: "list" })}
          onEdit={() => setView({ name: "edit", id: current.id })}
        />
      )}

      {view.name === "edit" && (
        <EditView
          recipe={view.id ? current : null}
          onSave={saveRecipe}
          onCancel={() =>
            setView(view.id ? { name: "recipe", id: view.id } : { name: "list" })
          }
          onDelete={view.id ? () => deleteRecipe(view.id) : null}
        />
      )}
    </div>
  );
}

function ListView({ recipes, all, cuisines, cuisineFilter, setCuisineFilter, timeFilter, setTimeFilter, q, setQ, open }) {
  return (
    <main className="rb-main">
      <div className="rb-list-head">
        <h1 className="rb-page-title">The book</h1>
        <p className="rb-page-sub">
          {all.length} {all.length === 1 ? "recipe" : "recipes"} — technique first,
          measured second.
        </p>
      </div>

      <div className="rb-filters">
        <input
          className="rb-search"
          placeholder="Search titles…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="rb-chiprow">
          <span className="rb-chiplabel">cuisine</span>
          <button
            className={`rb-chip ${!cuisineFilter ? "rb-chip-on" : ""}`}
            onClick={() => setCuisineFilter("")}
          >
            all
          </button>
          {cuisines.map((c) => (
            <button
              key={c}
              className={`rb-chip ${cuisineFilter === c ? "rb-chip-on" : ""}`}
              onClick={() => setCuisineFilter(cuisineFilter === c ? "" : c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="rb-chiprow">
          <span className="rb-chiplabel">time</span>
          <button
            className={`rb-chip ${!timeFilter ? "rb-chip-on" : ""}`}
            onClick={() => setTimeFilter("")}
          >
            any
          </button>
          {BUCKETS.map((b) => (
            <button
              key={b.id}
              className={`rb-chip ${timeFilter === b.id ? "rb-chip-on" : ""}`}
              onClick={() => setTimeFilter(timeFilter === b.id ? "" : b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {recipes.length === 0 ? (
        <div className="rb-empty">
          Nothing matches those filters. Clear them, or write a new recipe.
        </div>
      ) : (
        <ul className="rb-cards">
          {recipes.map((r) => (
            <li key={r.id}>
              <button className="rb-card" onClick={() => open(r.id)}>
                <span className="rb-card-title">{r.title}</span>
                <span className="rb-card-meta">
                  <span className="rb-tag">{r.cuisine || "—"}</span>
                  <span className="rb-tag rb-tag-time">{bucketLabel(r.cook_time)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function RecipeView({ recipe, onBack, onEdit }) {
  return (
    <main className="rb-main rb-recipe">
      <div className="rb-recipe-nav">
        <button className="rb-link" onClick={onBack}>← the book</button>
        <button className="rb-btn" onClick={onEdit}>Edit</button>
      </div>
      <div className="rb-recipe-head">
        <h1 className="rb-recipe-title">{recipe.title}</h1>
        <div className="rb-recipe-meta">
          <span className="rb-tag">{recipe.cuisine || "—"}</span>
          <span className="rb-tag rb-tag-time">{bucketLabel(recipe.cook_time)}</span>
        </div>
      </div>
      <article className="rb-recipe-body">
        <Markdown src={recipe.body_md} />
      </article>
    </main>
  );
}

function EditView({ recipe, onSave, onCancel, onDelete }) {
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [cuisine, setCuisine] = useState(recipe?.cuisine ?? "");
  const [cookTime, setCookTime] = useState(recipe?.cook_time ?? "under_15");
  const [body, setBody] = useState(recipe?.body_md ?? "");

  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: recipe?.id ?? slugify(title) || `recipe-${Date.now()}`,
      title: title.trim(),
      cuisine: cuisine.trim(),
      cook_time: cookTime,
      body_md: body,
    });
  };

  return (
    <main className="rb-main rb-edit">
      <div className="rb-recipe-nav">
        <button className="rb-link" onClick={onCancel}>← cancel</button>
        {onDelete && (
          <button className="rb-btn rb-btn-danger" onClick={onDelete}>Delete</button>
        )}
      </div>

      <div className="rb-field">
        <label className="rb-label">Title</label>
        <input
          className="rb-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Focaccia Dipping Oil"
        />
      </div>

      <div className="rb-field-row">
        <div className="rb-field">
          <label className="rb-label">Cuisine</label>
          <input
            className="rb-input"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            placeholder="Italian"
          />
        </div>
        <div className="rb-field">
          <label className="rb-label">Time</label>
          <div className="rb-seg">
            {BUCKETS.map((b) => (
              <button
                key={b.id}
                className={`rb-seg-btn ${cookTime === b.id ? "rb-seg-on" : ""}`}
                onClick={() => setCookTime(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rb-field">
        <label className="rb-label">
          Recipe <span className="rb-label-hint">— plain markdown</span>
        </label>
        <textarea
          className="rb-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="## Ingredients&#10;&#10;- …"
          spellCheck={false}
        />
      </div>

      <div className="rb-edit-actions">
        <button className="rb-btn" onClick={onCancel}>Cancel</button>
        <button
          className="rb-btn rb-btn-primary"
          onClick={handleSave}
          disabled={!canSave}
        >
          Save recipe
        </button>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Styling — cook's procedure-card direction.
// Utility monospace for metadata/structure; warm paper ground (not cream);
// technique callouts and tables render as bordered field-cards.
// ---------------------------------------------------------------------------

const CSS = `
.rb-root{
  --paper:#efe9dd;
  --paper-2:#e7dfcf;
  --ink:#241f1a;
  --ink-soft:#5c5346;
  --line:#c9bda6;
  --accent:#3a5a45;      /* deep herb green — not terracotta, not cream-serif */
  --accent-soft:#dfe6dc;
  --hot:#a2432b;         /* paprika, used sparingly */
  --mono:"SFMono-Regular",ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;
  --serif:"Iowan Old Style","Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;

  background:var(--paper);
  color:var(--ink);
  font-family:var(--serif);
  min-height:100vh;
  line-height:1.6;
}
.rb-root *{box-sizing:border-box}

/* Topbar */
.rb-topbar{
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 28px;border-bottom:1.5px solid var(--line);
  position:sticky;top:0;background:var(--paper);z-index:10;
}
.rb-brand{
  display:flex;align-items:baseline;gap:9px;background:none;border:none;
  cursor:pointer;color:var(--ink);padding:0;
}
.rb-brand-mark{color:var(--accent);font-size:19px;transform:translateY(2px)}
.rb-brand-name{font-family:var(--mono);font-weight:600;font-size:19px;letter-spacing:-.02em}
.rb-brand-sub{
  font-family:var(--mono);font-size:11px;text-transform:uppercase;
  letter-spacing:.18em;color:var(--ink-soft);
}

.rb-main{max-width:760px;margin:0 auto;padding:34px 28px 90px}

/* Buttons */
.rb-btn{
  font-family:var(--mono);font-size:13px;letter-spacing:.02em;
  padding:8px 15px;border:1.5px solid var(--ink);background:transparent;
  color:var(--ink);cursor:pointer;border-radius:2px;transition:all .12s;
}
.rb-btn:hover{background:var(--ink);color:var(--paper)}
.rb-btn-primary{background:var(--accent);border-color:var(--accent);color:#f4f1e8}
.rb-btn-primary:hover{background:#2c4636;border-color:#2c4636}
.rb-btn-primary:disabled{opacity:.4;cursor:not-allowed}
.rb-btn-danger{border-color:var(--hot);color:var(--hot)}
.rb-btn-danger:hover{background:var(--hot);color:var(--paper)}
.rb-link{
  background:none;border:none;font-family:var(--mono);font-size:13px;
  color:var(--ink-soft);cursor:pointer;padding:4px 0;
}
.rb-link:hover{color:var(--accent)}

/* List head */
.rb-list-head{margin-bottom:26px}
.rb-page-title{font-size:38px;font-weight:600;letter-spacing:-.02em;margin:0 0 4px}
.rb-page-sub{font-family:var(--mono);font-size:13px;color:var(--ink-soft);margin:0}

/* Filters */
.rb-filters{
  display:flex;flex-direction:column;gap:12px;margin-bottom:30px;
  padding-bottom:22px;border-bottom:1.5px solid var(--line);
}
.rb-search{
  font-family:var(--mono);font-size:14px;padding:9px 12px;
  border:1.5px solid var(--line);background:var(--paper-2);color:var(--ink);
  border-radius:2px;width:100%;
}
.rb-search:focus{outline:none;border-color:var(--accent)}
.rb-chiprow{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.rb-chiplabel{
  font-family:var(--mono);font-size:10px;text-transform:uppercase;
  letter-spacing:.16em;color:var(--ink-soft);width:52px;
}
.rb-chip{
  font-family:var(--mono);font-size:12px;padding:5px 11px;
  border:1.5px solid var(--line);background:transparent;color:var(--ink-soft);
  cursor:pointer;border-radius:99px;transition:all .12s;
}
.rb-chip:hover{border-color:var(--accent);color:var(--accent)}
.rb-chip-on{background:var(--accent);border-color:var(--accent);color:#f4f1e8}
.rb-chip-on:hover{color:#f4f1e8}

/* Cards */
.rb-cards{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0}
.rb-cards li{border-bottom:1px solid var(--line)}
.rb-card{
  width:100%;display:flex;align-items:baseline;justify-content:space-between;
  gap:16px;padding:17px 4px;background:none;border:none;cursor:pointer;
  text-align:left;color:var(--ink);transition:padding-left .14s;
}
.rb-card:hover{padding-left:12px}
.rb-card:hover .rb-card-title{color:var(--accent)}
.rb-card-title{font-size:21px;font-weight:500;letter-spacing:-.01em}
.rb-card-meta{display:flex;gap:7px;flex-shrink:0}

.rb-tag{
  font-family:var(--mono);font-size:11px;letter-spacing:.03em;
  padding:3px 9px;border:1px solid var(--line);border-radius:2px;
  color:var(--ink-soft);white-space:nowrap;
}
.rb-tag-time{background:var(--accent-soft);border-color:#bcc9bc;color:var(--accent)}

.rb-empty{
  font-family:var(--mono);font-size:14px;color:var(--ink-soft);
  padding:40px 0;text-align:center;
}

/* Recipe view */
.rb-recipe-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px}
.rb-recipe-head{margin-bottom:8px;padding-bottom:22px;border-bottom:2.5px solid var(--ink)}
.rb-recipe-title{font-size:40px;font-weight:600;letter-spacing:-.02em;margin:0 0 12px;line-height:1.1}
.rb-recipe-meta{display:flex;gap:8px}

/* Markdown body */
.rb-md{margin-top:30px}
.rb-h{font-weight:600;letter-spacing:-.01em;line-height:1.25}
.rb-h2{
  font-size:15px;font-family:var(--mono);text-transform:uppercase;
  letter-spacing:.14em;color:var(--accent);margin:38px 0 14px;
  padding-bottom:7px;border-bottom:1.5px solid var(--line);
}
.rb-h3{font-size:19px;margin:24px 0 10px;color:var(--ink)}
.rb-h4{font-size:16px;margin:18px 0 8px;color:var(--ink-soft)}
.rb-p{margin:12px 0}
.rb-list{margin:12px 0;padding-left:22px}
.rb-list li{margin:6px 0}
.rb-list li::marker{color:var(--accent)}
.rb-hr{border:none;border-top:1.5px dashed var(--line);margin:26px 0}
.rb-code{
  font-family:var(--mono);font-size:.86em;background:var(--paper-2);
  padding:1px 5px;border-radius:2px;border:1px solid var(--line);
}

/* Tables render as field-cards — the signature element */
.rb-table-wrap{margin:18px 0;border:1.5px solid var(--ink);border-radius:2px;overflow:hidden}
.rb-table{width:100%;border-collapse:collapse;font-size:14px}
.rb-table th{
  font-family:var(--mono);font-size:11px;text-transform:uppercase;
  letter-spacing:.1em;text-align:left;padding:10px 13px;
  background:var(--ink);color:var(--paper);font-weight:500;
}
.rb-table td{padding:11px 13px;border-top:1px solid var(--line);vertical-align:top}
.rb-table tr:nth-child(even) td{background:var(--paper-2)}

/* Editor */
.rb-field{margin-bottom:20px;display:flex;flex-direction:column}
.rb-field-row{display:flex;gap:18px;flex-wrap:wrap}
.rb-field-row .rb-field{flex:1;min-width:220px}
.rb-label{
  font-family:var(--mono);font-size:11px;text-transform:uppercase;
  letter-spacing:.14em;color:var(--ink-soft);margin-bottom:7px;
}
.rb-label-hint{text-transform:none;letter-spacing:0;color:var(--line)}
.rb-input{
  font-family:var(--serif);font-size:17px;padding:10px 12px;
  border:1.5px solid var(--line);background:var(--paper-2);color:var(--ink);
  border-radius:2px;
}
.rb-input:focus{outline:none;border-color:var(--accent)}
.rb-seg{display:flex;border:1.5px solid var(--line);border-radius:2px;overflow:hidden}
.rb-seg-btn{
  flex:1;font-family:var(--mono);font-size:12px;padding:10px 4px;
  background:var(--paper-2);border:none;border-right:1px solid var(--line);
  color:var(--ink-soft);cursor:pointer;transition:all .12s;
}
.rb-seg-btn:last-child{border-right:none}
.rb-seg-btn:hover{color:var(--accent)}
.rb-seg-on{background:var(--accent);color:#f4f1e8}
.rb-seg-on:hover{color:#f4f1e8}
.rb-textarea{
  font-family:var(--mono);font-size:13.5px;line-height:1.65;padding:14px;
  border:1.5px solid var(--line);background:var(--paper-2);color:var(--ink);
  border-radius:2px;min-height:440px;resize:vertical;tab-size:2;
}
.rb-textarea:focus{outline:none;border-color:var(--accent)}
.rb-edit-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:8px}

@media (max-width:560px){
  .rb-page-title{font-size:30px}
  .rb-recipe-title{font-size:30px}
  .rb-chiplabel{width:100%}
}
`;
