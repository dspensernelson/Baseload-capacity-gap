# Session 7 — The Table & Visual Polish

**Time estimate:** 3–4 hours  
**Goal:** Filterable reactor table, styled headline band, and a coherent visual identity.  
**End state:** The product looks like an advocacy piece for the public, not a default dashboard.

---

## Step 7.1 — The Reactor Table

This is the detail layer — where a journalist or curious reader finds their local plant.

**Claude Code prompt:**
```
Build out src/components/ReactorTable.jsx with:

Columns: state, plant name, unit number, operator, capacity (MW), 
commercial operation date, license expiration date, status

Filters (client-side):
- Status dropdown: All / Operating / Shutdown / Decommissioning
- State dropdown: All / [populated from data]
- Operator text search (partial match, case-insensitive)
- License expiration window: "Expiring before [year]" select (2030, 2035, 2040, all)

Sort: clicking column headers toggles asc/desc. Default sort: capacity_mw desc.

Style:
- Clean table, no outer border
- Alternating row shade (very subtle — #f9f9f9 on even rows)
- Status column uses colored chips matching map pin colors
- License expiration highlighted in amber if within 10 years of today

All logic client-side — no additional Supabase queries.
Show me the code first.
```

---

## Step 7.2 — The Headline Band

Three numbers, always visible, read straight from `headline_numbers`:

```
[97.2 GW operating]  [12.4 GW retiring by 2035]  [4.1 GW in pipeline]
```

The middle number (retiring capacity) must feel heavier than the others — this is the editorial weight of the product.

**Claude Code prompt:**
```
Create src/components/HeadlineBand.jsx that:
1. Accepts headlines prop (from headline_numbers view)
2. Renders three stats side by side in a full-width band
3. Formats MW values as GW with one decimal (e.g., 97,246 MW → "97.2 GW")
4. Labels: "Operating Today", "Retiring by 2035", "In the Pipeline"
5. The "Retiring by 2035" number should be:
   - Larger font size than the others (1.5x)
   - Color: amber (#f4a261)
   - Label below: "The Gap" in smaller text
6. Band background: very dark (near black) with white text
7. Always visible at the top of the page (sticky: no — just first in the layout)

Show me the code first.
```

---

## Step 7.3 — Visual Identity

Before styling anything else, make three decisions and apply them consistently:

**Decision 1: Brand color**
Choose one strong non-amber color as the primary brand color. Suggestions:
- Deep navy `#1d3557` — authoritative, policy feel
- Charcoal `#2b2d42` — editorial, newspaper feel
- Forest green `#2d6a4f` — connects to the "operating" map color

**Decision 2: Typography**
- Display face (headline numbers): Google Fonts — try `Playfair Display`, `DM Serif Display`, or `Barlow Condensed`
- Body face: `Inter`, `Source Sans Pro`, or `IBM Plex Sans`

Add to `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
```

**Decision 3: Amber is exclusive**
Amber (`#f4a261` or similar) is used ONLY for: the gap shading on the chart, the "Retiring" headline number, and license expirations within 10 years. Nowhere else.

**Claude Code prompt:**
```
Create src/styles/variables.css with CSS custom properties:
  --color-brand: [your choice]
  --color-amber: #f4a261
  --color-operating: #2d6a4f
  --color-shutdown: #6c757d
  --color-text: #1a1a1a
  --color-bg: #ffffff
  --color-surface: #f8f9fa
  --font-display: 'Playfair Display', Georgia, serif
  --font-body: 'Inter', system-ui, sans-serif
  --spacing-section: 4rem

Import this in main.jsx and replace all hardcoded color strings in components
with these variables.
```

---

## Step 7.4 — Section Layout Polish

**Claude Code prompt:**
```
Update App.jsx layout with these section rules:
- HeadlineBand: full-width, no max-width restriction
- Hook (map): max-width 1200px, centered, margin-top: var(--spacing-section)
- GapChart: max-width 900px, centered, margin-top: var(--spacing-section)
  Add a section title above it: "The Gap" in display font
- ReactorTable: max-width 1100px, centered, margin-top: var(--spacing-section)
  Add a section title: "Every Reactor" in display font
- Bottom padding: 6rem

Add a minimal site header: the project name and a one-line description.
No navigation — this is a single-page scrolling story.
```

---

## Step 7.5 — Desktop Review

Test at these viewport widths: 1280px and 1440px.

Checklist:
- [ ] Headline band spans full width with good visual weight
- [ ] Map fills its container without horizontal scroll
- [ ] Chart is readable with labeled axes
- [ ] Table is scannable — no column is cramped
- [ ] Color palette is consistent across all three screens
- [ ] Nothing uses amber outside the defined rules
- [ ] Typography hierarchy is clear: display → heading → body

---

## Session 7 Complete When

- [ ] Reactor table renders with all columns and filters work correctly
- [ ] Headline band shows three numbers with correct formatting and visual weight
- [ ] Visual identity (color, type) applied consistently across all components
- [ ] Product looks like a newspaper graphic, not a default Bootstrap site
- [ ] Show it to one person unfamiliar with the project — do they understand the thesis in 30 seconds?
