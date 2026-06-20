# Changelog

How the project evolved. Milestones, not semver — this is an institution, not a package.
Most recent first. (Fitting that a site with a History tab keeps its own history.)

---

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
