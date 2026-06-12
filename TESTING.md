# Testing Checklist — Nuclear Pipeline Tracker

> **How to use this:** Hand this file to a fresh Claude Code / Cowork instance and say
> *"Run the testing checklist in TESTING.md with me."* That agent drives the session — it
> runs what it can with its own tools, asks you to click/look where human eyes are needed,
> and records Pass/Fail + notes inline as you go. This is an interactive, human-in-the-loop
> QA pass, not an automated test suite.

---

## For the agent running this

You and the user are testing the live app together. Your job: drive efficiently, verify what
you can, and ask the user only for what genuinely needs human eyes.

**What you check yourself (tools):**
- Start the dev server with `preview_start` (config name **`nukemap-dev`**, port 5173) — or test
  the live site at **https://nukemap-two.vercel.app**. Prefer the live site for a real-world pass;
  use the dev server if testing un-deployed changes.
- Layout facts → `preview_eval` to read `clientWidth`/`scrollWidth`/computed styles. **Do NOT trust
  `preview_screenshot` for widths** — it downscales wide viewports and looks misleadingly tiny.
  Use screenshots for *appearance* (colors, spacing, "does it look right"), measurements for *facts*.
- Errors → `preview_console_logs` (level `error`) and `preview_network` for failed requests.
- Content/structure → `preview_snapshot`.

**What you ask the user to do:**
- **Anything involving clicking a map pin.** The map is WebGL — programmatic canvas clicks are
  unreliable. The user clicks; you observe the result (screenshot/snapshot) or ask them to read it back.
- Aesthetic judgment ("does the hierarchy feel right", "is the amber muddy").
- Phone testing (real device beats emulated viewport).

**Rules of engagement:**
- **Do not fix bugs mid-pass** unless the user says so. Log the finding and move on — fixing derails the run.
- Record each result inline: change `[ ]` → `[x]` for pass, `[!]` for fail, and add a `— note:` on fails.
- At the end, fill in the **Results summary** and offer to (a) file the fails as `spawn_task` items or
  (b) fix them now.
- Convert any "known imperfection" (see §K) into a non-finding — don't log expected gaps as bugs.

**Environment baseline (expected values as of last update):**
- ~94 reactor units; **Operating ≈ 101.9 GW**, **Retiring by 2035 ≈ 12.0 GW**, **Pipeline ≈ 4.2 GW**
- `daily_status_history` ≈ 92 reactors × ~366 days (only checkable with DB access — optional)
- Tester: `__________`  Date: `__________`  Commit/deploy: `__________`

---

## A. Hero chart (the gap banner)

**A1 — Banner renders correctly** · Driver: Both
- Steps: Load the page, look at the top banner.
- Expected: ~half-height green band, full-bleed edge-to-edge; "The Gap" title *inside* the green;
  amber wedge grows from the bottom-right; "12.0 GW gap by 2035" label on the chart; "120 GW"/"0 GW"
  scale on the left; year axis along the bottom.
- [ ] Pass

**A2 — Chart tooltip** · Driver: Human
- Steps: Hover across the chart.
- Expected: Tooltip shows Net capacity / Gap from baseline / Retiring / Adding for the hovered year;
  numbers change as you move; no flicker or NaN.
- [ ] Pass

**A3 — Headline numbers** · Driver: Agent
- Steps: Read the three callouts below the banner.
- Expected: 101.9 GW / 12.0 GW / 4.2 GW; middle number amber and largest; labels Operating Today /
  Retiring by 2035 / In the Pipeline.
- [ ] Pass

**A4 — No console errors on load** · Driver: Agent
- Steps: `preview_console_logs` level `error`; `preview_network` for non-200s.
- Expected: No errors; all Supabase requests 200; no failed asset loads.
- [ ] Pass

---

## B. Map

**B1 — Initial view** · Driver: Both
- Expected: Opens on the **whole continental US** (not zoomed into the Plains); all dots visible.
- [ ] Pass

**B2 — ISO/RTO region layer** · Driver: Both
- Expected: Soft colored regions with thin borders; **one label per region** (PJM, MISO, SPP, ERCOT,
  CAISO, ISO-NE, NYISO, WEST, SOUTHEAST) — **no repeated/stacked labels**; reactor dots render on top.
- [ ] Pass

**B3 — Dot encoding** · Driver: Agent
- Expected: Dots sized by capacity; operating = green; legend bottom-left matches.
- [ ] Pass

**B4 — Pan & zoom** · Driver: Human
- Expected: Scroll-zoom and drag work; zooming out keeps regions/labels clean; nav control (top-right) works.
- [ ] Pass

---

## C. Reactor detail panel  ← includes the new MW readout

**C1 — Open panel** · Driver: Human (clicks), Agent (observes)
- Steps: User clicks a large dot (e.g. **Palo Verde, AZ** or **Vogtle, GA**).
- Expected: Panel opens top-right with plant name, status badge, operator, state, capacity,
  commercial date, license exp, ISO/RTO.
- [ ] Pass

**C2 — Live MW output (NEW — verify the math)** · Driver: Both
- Expected: Power line reads like `100% power · ~1,310 MW now`. The MW ≈ (power % × capacity_mw).
  Sanity: a 100%-power unit should show ~its capacity; a unit at 0% reads "Offline — 0% power" (no MW).
- [ ] Pass — note any reactor where the MW looks wrong: `__________`

**C3 — License history lines** · Driver: Both
- Expected: Where applicable, ✓ approved renewals/extensions and ⏳ "under NRC review" (amber) lines;
  up to two, newest first.
- [ ] Pass

**C4 — Panel switching & close** · Driver: Human
- Expected: Clicking another dot updates the panel; clicking empty map closes it; × closes it.
- [ ] Pass

---

## D. Reactor table

**D1 — Columns & density** · Driver: Both
- Expected: 6 columns (St / Plant / Unit / Cap. / Lic. exp. / Status); compact, readable; capacity as
  whole MW (e.g. `1,403 MW`, no decimals); expiry within 10 yrs shown in amber.
- [ ] Pass

**D2 — Sticky header on scroll** · Driver: Agent
- Steps: Scroll the table body (`preview_eval` to scroll its container, or user scrolls).
- Expected: Header row stays pinned at the top of the table while rows scroll under it.
- [ ] Pass

**D3 — Sorting** · Driver: Human
- Expected: Clicking a header sorts by it; clicking again reverses; arrow indicator updates.
- [ ] Pass

**D4 — No layout overflow at desktop width** · Driver: Agent
- Steps: `preview_eval` → compare the table container's `clientWidth` vs `scrollWidth` at ≥1366px viewport.
- Expected: Equal (no horizontal scroll) at desktop width.
- [ ] Pass

---

## E. Filters & cross-linking

**E1 — ISO pills** · Driver: Both
- Steps: Click a pill (e.g. **PJM**).
- Expected: Map **and** table both filter to that ISO; reactor count updates; "All" resets.
- [ ] Pass

**E2 — Table dropdowns + search** · Driver: Human
- Expected: Status / State dropdowns and the operator search box each narrow the table correctly;
  combinations stack; count reflects the filtered set.
- [ ] Pass

---

## F. Methodology link  ← just fixed

**F1 — Link stays on-site** · Driver: Both
- Steps: Click "How we calculated this →" in the banner.
- Expected: Opens **`/methodology.html` on the site's own domain** — **NOT** github.com. Page is styled,
  content reads correctly, "← Back" returns to the tracker.
- [ ] Pass

---

## G. Data smell test

**G1 — Totals** · Driver: Agent
- Expected: ~94 rows in the table; operating total ≈ 101.9 GW; numbers internally consistent.
- [ ] Pass

**G2 — No junk values** · Driver: Both
- Expected: No `NaN` / `undefined` / `null` / blank cells; no off-map or uncolored dots; dates render as years.
- [ ] Pass

**G3 — (Optional, needs DB access) History tape** · Driver: Agent
- Expected: `daily_status_history` has ~33k rows, 92 reactors, ~366 distinct dates, mix of 100% / 0% / partial.
- [ ] Pass / [ ] Skipped (no DB access)

---

## K. Known imperfections (do NOT log these as bugs)

- **Mobile / narrow widths:** map+table side-by-side gets cramped and the table side-scrolls.
  This is the deferred V2 "mobile layout" item. Only flag it if it's *broken* (unreadable / overlapping /
  unclickable), not merely *cramped*.
- **`preview_screenshot` looks tiny at wide viewports** — a capture artifact, not a layout bug. Verify
  widths by measurement instead.
- **SMR pipeline (`new_reactor_projects`)** is intentionally hand-curated and may lag the latest announcements.

---

## Results summary  (agent fills in at the end)

| Section | Pass | Fail | Notes |
|---|---|---|---|
| A. Hero chart | / 4 | | |
| B. Map | / 4 | | |
| C. Detail panel | / 4 | | |
| D. Table | / 4 | | |
| E. Filters | / 2 | | |
| F. Methodology | / 1 | | |
| G. Data | / 3 | | |

**Overall:** ____ pass / ____ fail
**Fails / follow-ups:**
1. `__________`

**Next action:** ☐ file fails as background tasks ☐ fix now ☐ all green, nothing to do
