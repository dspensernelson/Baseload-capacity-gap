# Baseload — The Capacity Gap — Claude Code Context

> This file is auto-ingested by Claude Code. Read it at the start of every session before writing any code.

---

## What This Project Is

A public-facing, advocacy-leaning data visualization showing the gap between retiring US nuclear capacity and new build coming online. Tone is newspaper-graphic reference: it *shows*, it doesn't editorialize — no CTAs, no "we," and every element must survive a hostile fact-check. Three screens: a map (Hook), a gap chart (the thesis), and a filterable reactor table. Target audience: curious public. Aesthetic target: newspaper graphic, not BI dashboard.

**Operating model:** maximally automated — crons fetch and refresh the data, the build itself is AI-assisted, human input is reserved for direction and editorial curation. Full positioning and roadmap live in `docs/VISION.md` (internal — gitignored, local only).

**Public URL goal:** A visitor sees three headline numbers, a US reactor map colored by status, a gap chart through ~2045, and a filterable table — all backed by real EIA + NRC data, with at least one live daily cron making it feel alive.

---

## Stack

| Layer | Tool | Notes |
|-------|------|-------|
| Database | Supabase (Postgres) | Free tier. All data lives here. |
| Frontend | React + Vite + react-router | Tabs: Overview (`/`), History (`/history`), Map (`/map`), The Fleet (`/fleet`), The Grid (`/grid`), Incidents (`/incidents`), Safety (`/safety`), Dispatches (`/dispatches`), Scenarios (`/scenarios`), The Data (`/data`), The Sources (`/sources`); plus reactor permalinks (`/reactor/:slug`). `vercel.json` rewrites extensionless routes to index.html so deep links survive refresh |
| Map | MapLibre GL | Free, no token required. Use OpenFreeMap or CARTO free style. |
| Charts | Recharts | Area/composed chart for the gap visualization |
| Hosting | Vercel or Netlify | Free tier, connect to GitHub repo |
| ETL (v1) | Python scripts | One-off seed scripts, run manually |
| Crons | GitHub Actions | `nrc-daily.yml` (daily 08:00, power status) · `nrc-license-weekly.yml` (weekly Mon, license actions + the Regulatory Radar digest) · `health-check.yml` (watchdog — opens a GitHub issue if a cron breaks, closes it when healthy) · `monthly-dispatch.yml` (writes the monthly Dispatch) · `eia930-generation.yml` (every 6h — hourly grid mix for the 2 a.m. view) · `grid-reliability-daily.yml` (daily + after EIA-930 — materializes reliability snapshots) · `caiso-prices.yml` (daily — CAISO day-ahead + real-time LMP, no API key) · `nyiso-prices.yml` (every 6h — NYISO day-ahead + real-time zonal LBMP, no API key) · `ercot-prices.yml` (every 2h — ERCOT real-time hub LMP, no API key) · `reconcile.yml` (weekly + after the license cron — re-derives every headline from atomic rows, logs to `reconciliation_log`). Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `EIA_API_KEY` |
| Distribution | Vercel Functions | `api/og.js` (Edge, `@vercel/og` — live share card from `headline_numbers`) + `api/rss.js` (Node — Dispatches feed from `reports`, served at `/rss.xml`). Both read-only, anon key only, no service key. See [ADR-0012](docs/decisions/0012-thin-distribution-functions.md) |

---

## Repo Structure

```
baseload-capacity-gap/
├── CLAUDE.md                  ← you are here
├── CHECKLIST.md               ← master task checklist
├── TESTING.md                 ← usability checklist a second instance runs the user through one item at a time
├── VERIFY.md                  ← living "expected behavior + data fact-check" reference (run the 5-min pass regularly)
├── DESIGN.md                  ← architecture & data model overview
├── docs/
│   ├── VISION.md              ← long-term vision & positioning (internal; gitignored, local only)
│   ├── ROADMAP.md             ← 10-year horizons, invariants, and what to architecture-proof now
│   ├── ROADMAP.md             ← the 10-year horizons, invariants & risk plan (directional)
│   ├── data-model.md          ← full schema reference
│   ├── agent-runbook.md       ← how to work with Claude Code
│   ├── session-01.md          ← seed the database
│   ├── session-02.md          ← full schema & remaining seed data
│   ├── session-03.md          ← gap view (SQL)
│   ├── session-04.md          ← frontend skeleton
│   ├── session-05.md          ← map (Hook)
│   ├── session-06.md          ← gap chart
│   ├── session-07.md          ← table & visual polish
│   └── session-08.md          ← deploy & live cron
├── api/                        ← og.js (live OG share card), rss.js (Dispatches RSS) — ADR-0012
├── scripts/                   ← Python ETL scripts
├── src/                       ← React app
│   ├── pages/                 ← one per route (tab theory: one tab per visitor question)
│   │   ├── Overview.jsx       ← the thesis: gap banner + numbers + "explore the map" (/)
│   │   ├── MapPage.jsx        ← every reactor: map + table + ISO filter (/map)
│   │   ├── Fleet.jsx          ← our fleet's performance: live pulse + 12-month output (/fleet)
│   │   ├── Grid.jsx           ← nuclear vs. the grid: the 2 a.m. test + replacement math (/grid)
│   │   ├── Dispatches.jsx     ← what changed: latest + archive of monthly reports (/dispatches)
│   │   ├── Scenarios.jsx      ← what-ifs: drag-the-levers gap explorer (/scenarios)
│   │   └── Reactor.jsx        ← per-unit permalink: detail + sparkline + license history (/reactor/:slug)
│   ├── lib/slug.js            ← reactorSlug() for permalinks (plant_name + unit → "browns-ferry-1")
│   ├── components/            ← Hook (map), GapChart, FleetOutputChart, Dispatch, HeadlineBand, ReactorTable
│   ├── supabase.js            ← single Supabase client export
│   └── App.jsx                ← shell: data load, header+nav, Routes, footer
└── supabase/
    ├── schema.sql             ← all table DDL
    └── functions/             ← edge functions (cron jobs)
```

---

## Data Sources

| Source | What | How |
|--------|------|-----|
| EIA v2 API | Operating reactor inventory (~94 units) | `GET /v2/electricity/operating-generator-capacity` with `technology=Nuclear` facet |
| NRC decommissioning page | Shutdown/decommissioning units | Manual seed in Session 2 |
| NRC daily power reactor status | Daily power % per unit | Daily cron (`scripts/nrc_daily_status.py`) — NB: URL is case-sensitive, file is `ReportDt\|Unit\|Power` with plant+unit combined |
| NRC license renewal pages | License actions + authoritative expiration dates | Weekly cron (`scripts/nrc_license_actions.py`) — rebuilds `license_actions`, updates `reactors.license_expiration_date`, then `scripts/generate_radar.py` diffs it into the Regulatory Radar digest |
| DOE ARDP / NRC new reactors | SMR/new build pipeline | Manual seed, curated quarterly (intentionally not automated) |
| EIA-930 Hourly Electric Grid Monitor | US48 hourly generation by fuel type | `eia930-generation.yml` every 6h (`scripts/eia930_generation.py`) — feeds the 2 a.m. grid-mix view |
| CAISO OASIS | Day-ahead + real-time LMP, NP15/SP15 hubs | `caiso-prices.yml` daily (`scripts/caiso_prices.py`) — no API key needed |
| NYISO public MIS CSV | Day-ahead + real-time zonal LBMP | `nyiso-prices.yml` every 6h (`scripts/nyiso_prices.py`) — no API key needed |
| ERCOT MIS CDR (NP6-788) | Real-time hub LMP (`HB_HOUSTON`, `HB_NORTH`, `HB_SOUTH`, `HB_WEST`) | `ercot-prices.yml` every 2h (`scripts/ercot_prices.py`) — no API key needed |

**EIA API key:** Required. Store in `.env` as `EIA_API_KEY`. Never commit.  
**Supabase keys:** Store in `.env` as `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`. Never commit.

---

## Database Tables (18 total)

1. **`reactors`** — one row per reactor unit (operating, shutdown, decommissioning)
2. **`new_reactor_projects`** — SMR and new build pipeline (~10 rows, manual). **Capacity *arriving* only**: new builds + restarts of shut-down units. **Never** existing operating plants being renewed (SLRs like Diablo Canyon/Clinton/Seabrook) — those are already in `reactors` + `license_actions`; adding them double-counts the operating fleet and inflates the pipeline number.
3. **`decommissioning`** — shutdown details and capacity lost
4. **`license_actions`** — license renewals, expirations, uprate actions
5. **`sync_log`** — audit trail for every cron run
6. **`daily_status_history`** — one row per reactor per NRC report date (power %); the "tape" feeding sparklines, the fleet chart, and capacity-factor math. Written forward by the daily cron, backfilled by `scripts/backfill_status_history.py`
7. **`reports`** — published monthly "Dispatches" + the weekly Regulatory Radar digest (`kind` distinguishes them; markdown + stats jsonb), written by `scripts/generate_dispatch.py` / `scripts/generate_radar.py` and rendered on the site by `Dispatch.jsx` / `Dispatches.jsx`
8. **`generation_hourly`** — EIA-930 US48 hourly net generation by fuel type (period_utc, fueltype, mwh); powers the 2 a.m. grid-mix view (`GridMix.jsx`). Not watchdog-monitored (degrades gracefully)
9. **`metric_lineage`** — one row per number shown on the site: label, definition, exact formula, primary source + URL. The spine of the audit trail; read by `reconcile.py`, rendered on `/sources`
10. **`reconciliation_log`** — append-only receipt from `reconcile.py` (per-metric: our value vs independently re-derived value, delta, pass/drift)
11. **`energy_safety`** — deaths/TWh + lifecycle emissions by source (OWID/IPCC); powers Safety
12. **`notable_accidents`** — TMI/Chernobyl/Fukushima/Banqiao with sourced, ranged tolls; powers Safety
13. **`incidents`** — live NRC Event Notifications (plant events); written by `nrc_event_notifications.py` (daily), powers Incidents
14. **`history_milestones`** — the History timeline (sourced, 1938 → the gap)
15. **`demand_forecast`** — the EIA AEO reference-case demand-growth assumption (1 row, curated, annual-refresh) behind "Why this gets harder, not easier" on The Grid; feeds `demand_growth_series`. See ADR-0014
16. **`wholesale_prices`** — multi-ISO wholesale prices (CAISO day-ahead + real-time, NYISO day-ahead + real-time zonal LBMP, ERCOT real-time hub LMP; real-time rows older than 30 days are rolled up to hourly avg/min/max in `wholesale_prices_hourly`), powers "The price of intermittency" on The Grid. Core feeds are no-key.
17. **`grid_reliability_daily`** — daily materialized source reliability metrics (avg/p10/p90/CV/ramp95) derived from `generation_hourly`; powers The Grid reliability trend.
18. **`grid_firming_daily`** — daily materialized firming snapshot (overnight nuclear share and low-renewables-hour nuclear share) derived from `generation_hourly`; powers The Grid firming trend.

**Provenance columns:** `reactors`, `new_reactor_projects`, `decommissioning`, `license_actions` each carry `source`, `source_url`, `source_date`, `verified_at`, `provenance_note`. **Every curated row must cite a source** (watchdog- and reconcile-enforced). Full process in `docs/PROVENANCE.md`.

**Views:**
- `headline_numbers` — three summary stats (operating MW, retiring by 2035, pipeline MW)
- `gap_series` — year-by-year net capacity delta from now to 2045
- `demand_growth_series` — year-by-year low/high implied new firm capacity from EIA demand growth (The Grid page, not the gap chart — see the ADR-0014 amendment)
- `fleet_output_series` — daily fleet output (capacity × power %) from `daily_status_history`; powers the "Last 12 Months" chart
- `reactor_cf_90d` — per-unit average power % over the last 90 days (the Fleet "who ran hardest" table)

See `docs/data-model.md` for full schema.

---

## Key Decisions (Do Not Relitigate)

- **MapLibre over Mapbox** — free, no token, no billing surface
- **Manual seed for SMR/decommissioning data** — only ~15–20 rows, moves quarterly, manual is correct
- **SQL views for aggregation** — all editorial math lives in Postgres, not in React components
- **No auth, no realtime, no payments in v1** — explicitly deferred to v2
- **Audience = curious public** — newspaper graphic aesthetic, not BI tool
- **Nuclear is the hero** — framing is "what quietly holds the lights on," not nuclear vs renewables
- **Tab theory (placement rule)** — one tab per visitor question: Overview = the argument · History = how we got here (the story of nuclear power) · Map = places · The Fleet = our own performance · The Grid = nuclear vs. other sources · Incidents = the live NRC event wire · Safety = is nuclear actually safe (cross-source deaths/TWh + the famous accidents) · Dispatches = change over time · Scenarios = what-ifs · The Data = download the raw records · The Sources = how every number is defined, computed & sourced. Place a new feature by this rule; don't bolt it onto whatever page is handy. **Nav grouping (June 2026):** the surfaces are grouped into five sections — Overview · History · The Fleet ▾ (Map/Performance/Incidents) · The Case ▾ (Safety/The Grid/Scenarios) · Dispatches; The Data + The Sources live in the footer. The one-question-per-surface rule still holds; the nav just stopped being flat (see ADR-0005).
- **Show, don't tell** — the site presents, it never exhorts; no CTAs, no "we." Every element must survive a hostile fact-check
- **Automation ratchet** — any recurring manual task is treated as a defect; the fix is a cron or an agent (see VISION.md)
- **Provenance / traceability** — every curated row carries `source`/`source_url`/`verified_at`; every public number is registered in `metric_lineage` with its exact formula + primary source; `reconcile.py` (weekly) re-derives the headlines from atomic rows into `reconciliation_log`; `/sources` renders it. **Never** add a curated row without provenance, or a visible number without a `metric_lineage` entry. If you change a SQL view's formula, update the matching `metric_lineage.formula` in the same commit. See `docs/PROVENANCE.md`
- **Documentation freshness** — docs are kept true the way numbers are: `scripts/docs_check.py` fails on drift (undocumented tables, unmentioned crons). Follow the freshness contract in `docs/INDEX.md` — new table → `data-model.md` + a `supabase/*.sql`; new cron → README; notable decision → an ADR in `docs/decisions/`. Start doc work at `docs/INDEX.md`
- **Thin, read-only distribution functions only** — `api/og.js` and `api/rss.js` ([ADR-0012](docs/decisions/0012-thin-distribution-functions.md)) are the one exception to "no backend server," and deliberately narrow: stateless, anon-key-only, no writes, no secrets. Extend these two for future distribution needs (e.g. per-reactor OG cards) rather than adding a new server surface.
- **Wind/solar comparison, live district output, ADAMS feeds** — all v2

---

## Visual Identity Rules

- One strong brand color (TBD by builder)
- Amber reserved **exclusively** for "the gap" — do not use it elsewhere
- Display typeface for headline numbers; clean readable face for body
- Hook → Gap Chart → Table: this order of visual prominence is fixed
- Must not look like a default dashboard

---

## Coding Conventions

- All Supabase queries go through `src/supabase.js` — never inline credentials
- Filter/sort logic for the reactor table stays **client-side** (only ~200 rows max)
- No aggregation logic in React components — consume views, don't re-aggregate
- Every cron run writes to `sync_log` — this is non-negotiable
- Upsert (not insert) on seed scripts, keyed on `eia_plant_id + unit_number`
- Read the generated code line by line before running it — don't black-box ETL
- **Least privilege on the public API** — `anon`/`authenticated` are read-only (`supabase/privileges.sql`); the only public write is `INSERT (email, source)` on `subscribers`. New tables start `SELECT`-only with RLS on; never `GRANT` write privileges to `anon`/`authenticated`, and apply `privileges.sql` last on any rebuild. See the access model in `docs/data-model.md`

---

## V2 Parking Lot (Do Not Build in V1)

> Sequencing and rationale for all of this now lives in `docs/VISION.md` (five-phase roadmap). The list below remains the quick reference.

- EIA-930 live generation by balancing authority
- Wind/solar/storage context layer
- EIA-923 monthly generation refresh cron
- ~~NRC license-renewal scraper~~ — **built** (June 2026, monthly cron); uprate tracking still open
- ADAMS document feed / change alerts
- Mobile layout, shareable deep links, embeddable chart
- Full Paperclip agent org (Data Engineer, Research, Scraper, Content agents)
- Auth, payments, user accounts, realtime websockets

---

## Current Session

> Update this section at the start of each working session.

**Active session:** September 19, 2026 — audit + newsletter launch prep (branch `newsletter-hardening`)
**State of the world (verified Sept 19, not assumed):** site + all `api/*` endpoints 200; 15/16 workflows green on schedule, every `sync_log` source fresh; no open watchdog issues. Shipped since the June 26 entry and never recorded here: News page + durable `news_items` archive (`news-daily.yml`), weekly newswire digest (`newsletter-weekly.yml` → `generate_newsletter.py` + `send_newsletter.py`), email capture (`api/subscribe.js`, `api/unsubscribe.js`, `subscribers` table, site-wide footer signup), `api/news|newsletter|snapshot|trends`, `keepalive.yml`, ADR-0016 partial-success crons. 20 tables.
**The newsletter has never emailed anyone.** 13 digests are on web/RSS, but `RESEND_API_KEY` / `NEWSLETTER_FROM` / `ANTHROPIC_API_KEY` were never set, so the send step logs `skipped` and exits 0. The default From domain (`nuclearpipeline.org`) has no DNS. 1 active subscriber. **Green workflow ≠ working — read `sync_log.status`.**
**This session:** watchdog check 3d (active subscribers + unsent digest = fail; digest overdue = fail); `send_newsletter.py --test-to` proof sends; `subscribers` anon grant narrowed to `(email, source)` + sanity constraints (**SQL in repo, not yet applied live**); Actions bumped off Node 20 (checkout v7, setup-python v7, github-script v9).
**Next planned:** (1) user: sending domain + Resend account + secrets; (2) test send → review render → first real send via `workflow_dispatch`; (3) double opt-in before any promotion (`subscribers.confirmed` exists, unused); (4) `wholesale_prices` rollup — 113 MB of a 151 MB DB, ~9 MB/week, NYISO real-time is 70% of rows, free-tier cap is 500 MB (~mid-2027); (5) PJM workflow: key it or delete it (dead since June 27).
**Blockers:** sending domain + Resend key (user-only).
**A fresh thread can start cold from this file + `docs/INDEX.md`** — that's the point of the documentation overhaul. Memory files at the user level (`nukemap-deployment.md`, `nukemap-identity.md`) cover the URL/deploy/auth mechanics and the hidden-advocacy end-state; this file + git log/CHANGELOG.md cover everything else.
