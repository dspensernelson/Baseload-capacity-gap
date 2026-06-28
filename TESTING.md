# Usability Testing — Baseload — The Capacity Gap

> **New instance: read this, then run the user through the checklist ONE ITEM AT A TIME.**
>
> Do **not** dump the whole list at once. For each numbered test:
> 1. Present just that one test — what to do and what they should expect to see.
> 2. **Wait** for the user to do it and report back (pass / fail / weird).
> 3. Record the result on the test's `Result:` line (✅ pass, ❌ fail + a short note).
> 4. Move to the next test.
>
> Keep it conversational and quick. If a test fails, note it and keep going — don't stop to fix
> things unless the user asks. At the very end, give the **Summary** and ask whether they want the
> failures fixed now or filed for later.
>
> Companion: **VERIFY.md** is the broader "expected behavior + data fact-check" reference (per-page behavior, primary sources to confirm the numbers, red flags). Use this file for a guided UI click-through; use VERIFY.md for the regular health pass.
>
> Site to test: **https://baseload-capacity-gap.vercel.app**
> Tester: `________`   Date: `________`

---

## 1. The hero chart (top banner)
Look at the big green banner at the very top.
**Expect:** "The Gap" title sits inside the green; an amber wedge grows in from the bottom-right;
"13.2 GW gap by 2035" label is on the chart; year labels run along the bottom.
**Result:** ⬜

## 2. Chart hover
Move your mouse across the chart.
**Expect:** a tooltip appears showing Net capacity / Gap / Retiring / Adding for that year, updating as you move. No flicker, no "NaN".
**Result:** ⬜

## 3. The three headline numbers
Look just below the banner.
**Expect:** 101.9 GW (Operating Today) · 13.2 GW (Retiring by 2035, amber & biggest) · 2.0 GW (In the Pipeline).
**Result:** ⬜

## 4. Map — opening view
Look at the map.
**Expect:** it shows the **whole continental US** (not zoomed into the middle); reactor dots are visible across the country.
**Result:** ⬜

## 5. Map — ISO/RTO regions
Look at the colored regions behind the dots.
**Expect:** soft colored areas with thin borders and **one label each** (PJM, MISO, ERCOT, CAISO, WEST, SOUTHEAST, etc.) — no repeated/stacked labels. Dots sit on top.
**Result:** ⬜

## 6. Map — zoom & pan
Scroll to zoom and drag to pan.
**Expect:** both work smoothly; zooming out keeps the regions and labels looking clean.
**Result:** ⬜

## 7. Reactor detail — open it
Click a big dot (try **Palo Verde, AZ** or **Vogtle, GA**).
**Expect:** a panel opens top-right with operator, state, capacity, commercial date, license expiration, ISO/RTO.
**Result:** ⬜

## 8. Reactor detail — live MW (the new bit)
On that panel, find the power line.
**Expect:** reads like **`100% power · ~1,310 MW now`**. The MW should be roughly (power % × capacity). A unit at 0% should say "Offline — 0% power".
**Result:** ⬜  ← if the MW looks wrong on any reactor, note which: `________`

## 9. Reactor detail — license history
Still on a panel (a renewed plant shows the most).
**Expect:** lines like "✓ License extension (80 yr) → licensed to 2053" and/or "⏳ under NRC review" in amber.
**Result:** ⬜

## 10. Reactor detail — switch & close
Click a different dot, then click empty ocean.
**Expect:** the panel updates to the new reactor, and closes when you click away (or hit ×).
**Result:** ⬜

## 11. Table — layout
Look at the table to the right of the map.
**Expect:** 6 readable columns (St / Plant / Unit / Cap. / Lic. exp. / Status); capacity as whole MW (e.g. `1,403 MW`); soon-to-expire licenses in amber.
**Result:** ⬜

## 12. Table — sticky header
Scroll down inside the table.
**Expect:** the column header row stays pinned at the top while rows scroll under it.
**Result:** ⬜

## 13. Table — sorting
Click a column header (e.g. "Cap."), then click it again.
**Expect:** rows sort by that column, and reverse on the second click; an arrow shows the direction.
**Result:** ⬜

## 14. Filters — ISO pills
Click an ISO pill (e.g. **PJM**).
**Expect:** both the map **and** the table filter to that region; the reactor count updates. "All" resets it.
**Result:** ⬜

## 15. Filters — table controls
Use the Status dropdown, State dropdown, and the "Search operator…" box.
**Expect:** each narrows the table correctly; they stack; the count reflects what's shown.
**Result:** ⬜

## 16. "How we calculated this" link
Click **"How we calculated this →"** in the green banner.
**Expect:** opens **The Sources** tab (`/sources`) — the live audit trail: every number's definition, exact formula, source, and the last-reconciled date. (The old `/methodology.html` now redirects here.)
**Result:** ⬜

## 17. Responsiveness (known weak spot)
Make the window narrow, or open it on your phone.
**Expect:** it gets cramped and the table side-scrolls — that's the known "mobile is V2" gap. Only a problem if it's actually **broken** (overlapping, unreadable, unclickable).
**Result:** ⬜

## 18. Data smell test
Skim the table and numbers.
**Expect:** ~94 reactors; familiar plants look right (capacity, state, status); no `NaN`/`undefined`/blank cells; no stray uncolored dots.
**Result:** ⬜

---

## Summary  (fill in at the end)

- **Passed:** ___ / 18
- **Failed:** ___
- **Failures & notes:**
  1. `________`
- **Next:** ⬜ fix failures now ⬜ file them for later ⬜ all good, nothing to do
