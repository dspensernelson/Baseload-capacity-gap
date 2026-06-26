# ADR-0014 — The demand-growth band on the gap chart

**Status:** Accepted · **Era:** Post-V1, June 2026

## Context
VISION's V2 thesis ("the Race") asks whether the buildout keeps pace with demand growth,
not just retirements. This is the gap chart's first addition since launch, and it lands on
the site's single most scrutinized visual — the hero chart everyone screenshots. Two things
needed pinning down before touching it: which demand dataset, and how to make a whole-grid
energy number (TWh) comparable to a nuclear-only capacity number (GW) without overclaiming.

## Decision
- **Source:** EIA [Annual Energy Outlook 2026](https://www.eia.gov/outlooks/aeo/) (released
  April 2026, the current edition — supersedes AEO2025) reference case: total US electricity
  consumption growing **0.9%–1.6%/yr through 2050**, citing data centers as a major factor.
  Baselined to the last actual full year: **4,430 TWh in 2024** ([Today in
  Energy](https://www.eia.gov/todayinenergy/detail.php?id=65264), an all-time high ending two
  decades of flat demand).
- **Conversion:** the growth above the 2024 baseline is converted to "implied new firm
  capacity" using the **same 90% capacity-factor yardstick already disclosed in
  `ReplacementMath.jsx`** — i.e. "how much new nuclear-like firm generation this growth would
  take," not a blended blended-mix or renewables-specific assumption. Formula lives in
  `demand_growth_series` (`supabase/demand_forecast.sql`):
  `(baseline_twh × (1+rate)^(year−baseline_year) − baseline_twh) × 1e6 / (8760 × 0.90)`.
- **Explicitly not a claim that nuclear alone must cover this growth.** The chart subtitle
  and tooltip both say so. It's the same firm-capacity exchange rate used everywhere else on
  the site, applied for scale — consistent with VISION's "other energy systems: context, not
  combat" rule.
- **Shown as a low–high band** (not a single reference line), rendered as an independent
  Recharts stack (`stackId="2"`, separate from the existing capacity stack) so it overlays
  without disturbing the existing amber/green stacked-area math.
- `demand_forecast` is a curated table (one row, annual-refresh cadence — same class as
  `new_reactor_projects`), not scraped: AEO is published roughly annually, and the editorial
  judgment of which scenario to feature belongs to a human, not a cron.

## Consequences
- A bug surfaced during build-and-verify, worth recording: stacked `Area` series with `null`
  values across the *entire* dataset broke Recharts' domain calculation for the whole chart
  silently (no console error) — would have blanked the hero chart for every visitor the
  moment this shipped, since `demand_growth_series` doesn't exist until the migration runs.
  Fixed by defaulting missing demand values to `0` (an invisible zero-height band) instead of
  `null`. **Lesson for future stacked-series additions: always default to 0, never null, and
  verify in a live preview before shipping — this one didn't throw, it just silently broke.**
- `demand_growth_series` joins against whichever `demand_forecast` row is newest
  (`scenario='reference'`) — updating to AEO2027 later is a single curated INSERT, no schema
  or chart code change.
- Registered in `metric_lineage` (`demand_growth_gw`, sort_order 15) per the provenance rule.

## Amendment (June 25, 2026) — moved off the gap chart, onto The Grid

Shipped as above, then pulled the same day on direct user feedback: showing whole-grid
demand growth on the nuclear-specific hero chart read as confusing, not clarifying — it
blurred "the Gap" (nuclear's own retiring-vs-replacing math) with a different, broader
question (does *any* firm capacity keep pace with demand). The fix wasn't the methodology —
the sourcing, formula, and 90%-capacity-factor framing all held up — it was placement.

**This is the "context, not combat" rule applied a second time**, this time against the
site's own hero visual, not just other energy sources: broader-than-nuclear context belongs
in The Grid's dedicated comparison modules (`GridMix`, `WholesalePrices`, now
`DemandGrowth.jsx`), never stacked onto the Overview gap chart. The data, table, view, and
metric_lineage entry are unchanged — only the component moved. New section "Why this gets
harder, not easier" on `/grid`, right after the pricing pilot, framed as raising the stakes
on the 2 a.m. test and the price-of-intermittency story rather than as its own competing
thesis. The Overview gap chart is back to exactly its original two-area shape.
