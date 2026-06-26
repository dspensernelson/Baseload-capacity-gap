# Changelog

How the project evolved. Milestones, not semver — this is an institution, not a package.
Most recent first. (Fitting that a site with a History tab keeps its own history.)

---

## Wholesale pricing pilot: CAISO — June 2026
Extends The Grid's "2 a.m. test" with the price story: a new "The price of intermittency"
section showing CAISO day-ahead hourly LMP (NP15/SP15) over the last 48 hours, with a
dynamically-computed callout (cheapest vs. priciest hour). The original plan was to start
with EIA wholesale price data — verified against the live EIA API instead of assumed, and it
turned out **EIA has no wholesale price route at all**; the wholesale-markets page is a
biweekly Excel file licensed from a commercial exchange (ICE), the wrong granularity for an
hourly story regardless. Pivoted to a CAISO pilot instead — confirmed free, public, no API
key (more open than EIA's own API). New `wholesale_prices` table, `iso`/`market` columns
designed for more ISOs or real-time prices later without a schema change. See
[ADR-0015](docs/decisions/0015-caiso-pricing-pilot.md).

## Demand-growth band on the gap chart — June 2026
The first move toward VISION's V2 thesis ("the Race"): a low-high band showing how much new
firm capacity nationwide electricity demand growth implies, EIA AEO2026 reference case
(0.9-1.6%/yr through 2050) baselined to the actual 2024 high (4,430 TWh). Converted to GW
using the same 90% capacity-factor yardstick already disclosed in `ReplacementMath.jsx` —
explicitly not a claim nuclear alone must cover the growth. New `demand_forecast` table
(curated, annual-refresh) + `demand_growth_series` view; registered in `metric_lineage`.
Caught and fixed a real bug during build: a stacked Recharts `Area` series with `null`
values across the whole dataset silently breaks the chart's domain calculation — would have
blanked the hero chart for every visitor pre-migration. See [ADR-0014](docs/decisions/0014-demand-growth-band.md).

## Regulatory Radar weekly digest — June 2026
VISION Surface 3, scoped to what's already in the database. The license cron moved from
monthly to weekly (`nrc-license-weekly.yml`, renamed from `nrc-license-monthly.yml`) — a
real freshness improvement, not just a workaround — and now runs `scripts/generate_radar.py`
right after the scraper. Since `license_actions` is fully rebuilt from nrc.gov on every run
(no row history to query), the script snapshots state into `reports.stats` and diffs it
against last week's snapshot to write a plain-English "what changed" digest (new filings,
approvals). Reuses the `reports` table (`kind='weekly_radar'`). Rendered on `/dispatches`
**alongside** the existing always-live pending/issued list, not replacing it — one answers
"what's true now," the other "what changed." See [ADR-0013](docs/decisions/0013-radar-snapshot-diff.md).

## Distribution: OG cards, JSON-LD, RSS — June 2026
ROADMAP H1's first slice. Added `/dispatches/:period` permalinks so every Dispatch has a
stable URL; a live, branded OG/Twitter share card (`api/og.js`, Edge + `@vercel/og`,
rendered from `headline_numbers` on every request — no rebuild needed to stay current);
an RSS 2.0 feed of Dispatches (`api/rss.js`, served at `/rss.xml`); and `WebSite`/`Dataset`
JSON-LD in `index.html` for machine discovery. The two functions are the first server-side
compute in the stack beyond GitHub Actions crons — both read-only, anon-key-only, no
secrets. See [ADR-0012](docs/decisions/0012-thin-distribution-functions.md). A scoped
email-syndication newsletter was discussed and parked (no clear subscriber demand for a
"Dispatch" specifically) — see CLAUDE.md.

## Documentation overhaul — June 2026
The docs are brought to the same bar as the data: accurate, complete, self-auditing.
- Rewrote `README.md`, `docs/data-model.md`, replaced stale `DESIGN.md` with `docs/ARCHITECTURE.md`.
- New: `docs/REBUILD.md` (zero-to-live runbook), `docs/SOURCES.md` (system of record),
  `docs/decisions/` (11 ADRs), `docs/INDEX.md`, this changelog.
- Closed reproducibility holes: added `supabase/generation_hourly.sql` and `supabase/seed_curated.sql`.
- Added `scripts/docs_check.py` — fails if the docs drift from the code.
- Archived the V1 build log (`agent-runbook.md`, `session-0X.md`) as period artifacts.

## History tab — June 2026
A sourced vertical timeline of nuclear power, 1938 fission → the gap. New `history_milestones`
table (18 entries, DOE/WNA/NRC/EIA/UNSCEAR), registered on `/sources`.

## Safety tab — June 2026
The safety case as its own tab: the honest TMI/Chernobyl/Fukushima/Banqiao record + the
deaths-per-TWh comparison + the "safe and clean" scatter. New `energy_safety` and
`notable_accidents` tables (OWID / IPCC / UNSCEAR). (Briefly shipped as "The Toll.")

## Incidents tab — June 2026
The live NRC Event Notification wire. New `incidents` table + `nrc_event_notifications.py`
scraper + `nrc-events.yml` (daily). Parser written against a live CI fetch of NRC's HTML;
filtered to plant events.

## The Data & The Sources tabs — June 2026
Open-data export (CSV/JSON + REST API + embeds) and the public audit trail. Methodology folded
into `/sources`; `/methodology.html` now redirects there.

## Provenance system — June 2026
Born from two caught errors (Diablo SLR mislabeled, Watts Bar null license). Added provenance
columns to every curated table, the `metric_lineage` registry, `reconcile.py` +
`reconciliation_log` (weekly), watchdog guards, and the public `/sources` page. "Every number
survives a hostile fact-check" became literally true and visible. See ADR-0006.

## Post-V1 automation — early–mid 2026
Daily status history tape, EIA-930 ingestion (2 a.m. view), reactor permalinks, the watchdog
(`health-check.yml`), the monthly Dispatch, the Scenarios explorer, license-action scraping.
The loop closed end-to-end: data → watchdog → content, no human in the path.

## V1 — 2025 → early 2026
The original build (8 sessions, `docs/session-0X.md`): the gap thesis, the three headline
numbers, the reactor map + table, the gap chart, six tabs, EIA/NRC seed, the first two crons.
Live at https://nukemap-two.vercel.app.
