# Baseload — The Capacity Gap

**Live: https://nukemap-two.vercel.app**

A public, self-updating visualization of the American nuclear transition — every
reactor, every megawatt, every regulatory event — backed by real NRC and EIA data
that refreshes itself with no one at the wheel. It *shows*; it doesn't editorialize.
Every number on the site is traceable to a primary source on the live [Sources](https://nukemap-two.vercel.app/sources) page.

> New here? Read [`docs/INDEX.md`](docs/INDEX.md) — it maps every document to who it's for.
> Rebuilding from scratch? [`docs/REBUILD.md`](docs/REBUILD.md) takes you zero → live.

---

## The thesis, in three numbers

| Number | Meaning | Primary source |
|--------|---------|----------------|
| **Operating today** (~102 GW) | nameplate capacity of all operating units | EIA-860M |
| **Retiring by 2035** (~13 GW) | capacity whose NRC license expires ≤ 2035 and isn't renewed past it | NRC List of Power Reactor Units |
| **In the pipeline** (~2 GW) | confirmed new build + restarts arriving by 2035 | NRC New Reactors + DOE ARDP (curated) |

US nuclear capacity is retiring faster than new build is arriving. The site makes that
gap visible — and then surrounds it with the context that makes it legible.

---

## What's inside (five sections + footer)

The nav groups eleven surfaces into five sections; the two trust/utility surfaces live in the footer.

| Section | Surfaces | What it answers |
|---------|----------|-----------------|
| **Overview** (`/`) | the full-bleed gap chart through 2045 + the three headline numbers | what's the story? |
| **History** (`/history`) | a sourced timeline of nuclear power, 1938 → the gap | how we got here |
| **The Fleet** ▾ | **Map** (`/map`) · **Performance** (`/fleet`) · **Incidents** (`/incidents`) | the operating reality — where reactors are, how they're running, what just happened |
| **The Case** ▾ | **Safety** (`/safety`) · **The Grid** (`/grid`) · **Scenarios** (`/scenarios`) | the argument in context — how safe, vs. other sources, and the what-if explorer |
| **Dispatches** (`/dispatches`) | an auto-written monthly report (`/dispatches/:period` permalinks, [RSS](https://nukemap-two.vercel.app/rss.xml)) + a regulatory radar of NRC license activity | what changed |
| *footer* | **The Data** (`/data`) · **The Sources** (`/sources`) | the open data export, and the public audit trail (every number's formula + source) |

Plus reactor permalinks (`/reactor/:slug`) and an embeddable gap chart (`/embed/gap`).

---

## Architecture (one minute)

- **Database** — Supabase (Postgres), 18 tables + 7 views. *All* editorial math lives in
  SQL views (`headline_numbers`, `gap_series`, `fleet_output_series`, `reactor_cf_90d`);
  React only renders. Public read-only via RLS + the anon key.
- **Frontend** — React + Vite + react-router (tabbed pages + reactor permalinks),
  MapLibre GL (map), Recharts (charts). On Vercel; every push to `main` auto-deploys.
- **Automation** — 11 GitHub Actions crons keep the data fresh with zero manual upkeep;
  a **watchdog** confirms they ran; a weekly **reconciliation** re-derives every headline
  from atomic rows and proves it still matches its source. Every run writes to `sync_log`.
- **Distribution** — two thin, read-only Vercel functions (`api/og.js`, `api/rss.js`),
  anon-key-only, no app server. See [ADR-0012](docs/decisions/0012-thin-distribution-functions.md).
  Newsletter syndication now also exposes `newsletter.xml` via `api/newsletter.js`, and the
  news archive is queryable as JSON at `news.json` (`?limit=&offset=&source=&category=&since=&q=`)
  via `api/news.js`. Companion open-data endpoints: `trends.json` (most-mentioned entities),
  `snapshot.json` (downloadable daily bundle), `api.json` (self-documenting catalog), and a
  signup endpoint `api/subscribe` that writes to the insert-only `subscribers` table.

Full picture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Schema: [`docs/data-model.md`](docs/data-model.md).

### The crons

| Workflow | Schedule | What it does |
|----------|----------|--------------|
| `nrc-daily.yml` | daily 08:00 UTC | NRC power status → `reactors.daily_status` (94 units) + appends `daily_status_history` |
| `nrc-license-weekly.yml` | weekly, Mon 09:00 UTC | NRC renewal pages → rebuilds `license_actions`, updates `reactors` expiration dates; then drafts the Regulatory Radar digest → `reports` |
| `eia930-generation.yml` | every 6 h | EIA-930 hourly US generation by fuel → `generation_hourly` (the 2 a.m. view) |
| `grid-reliability-daily.yml` | daily + after EIA-930 runs | materializes daily reliability snapshots → `grid_reliability_daily`, `grid_firming_daily` |
| `nrc-events.yml` | daily 09:00 UTC | NRC Event Notifications → `incidents` (the live wire) |
| `monthly-dispatch.yml` | monthly, 2nd | drafts the plain-English Dispatch → `reports` |
| `news-daily.yml` | daily 10:00 UTC | ingests free power-sector feeds into the durable `news_items` archive (additive, de-duplicated by URL) |
| `newsletter-weekly.yml` | weekly, Mon 12:00 UTC | curates high-signal headlines from the `news_items` archive into a weekly Newswire digest → `reports` (`kind='weekly_news'`); optional Claude lead if `ANTHROPIC_API_KEY` exists; then emails the digest to active `subscribers` via `scripts/send_newsletter.py` (no-op unless `RESEND_API_KEY` is set) |
| `reconcile.yml` | weekly Mon + after license cron | re-derives headlines from atomic rows → `reconciliation_log`; flags drift |
| `health-check.yml` | after each cron + daily | watchdog: freshness/sanity + provenance completeness; opens a GitHub issue only on failure |
| `caiso-prices.yml` | daily 16:00 UTC | CAISO OASIS pricing (day-ahead + real-time, NP15/SP15) → `wholesale_prices` — no API key needed |
| `nyiso-prices.yml` | every 6 h | NYISO public MIS zonal LBMP (day-ahead + real-time) → `wholesale_prices` — no API key needed |
| `ercot-prices.yml` | every 2 h | ERCOT public MIS CDR real-time hub LMP (HB_HOUSTON/HB_NORTH/HB_SOUTH/HB_WEST) → `wholesale_prices` — no API key needed |
| `pjm-prices.yml` | manual (`workflow_dispatch`) | Optional PJM Data Miner day-ahead hourly LMP (WEST/MIDATL) → `wholesale_prices` (requires `PJM_API_KEY`) |

`/grid` now includes two source-backed reliability layers filled by a daily cron from EIA-930:
- `grid_reliability_daily` — per-day source reliability snapshots (avg/range/CV/ramp stress).
- `grid_firming_daily` — per-day firming snapshots (overnight nuclear share + low-renewables-hour nuclear share).

**Manual by design:** `new_reactor_projects` (~7 rows of editorial judgment about which
SMR/new-build projects are credible) and the curated reference tables (`energy_safety`,
`notable_accidents`, `history_milestones`). Everything a cron *can* fetch, it does.

---

## Provenance — every number survives a hostile fact-check

This is the product's spine, not a feature. Every curated row carries its source; every
public number is registered in `metric_lineage` with its exact formula + primary source;
`scripts/reconcile.py` re-derives the headlines weekly and logs the result; the public
`/sources` page renders it all. See [`docs/PROVENANCE.md`](docs/PROVENANCE.md).

The same discipline guards the docs: [`scripts/docs_check.py`](scripts/docs_check.py)
(run in CI by `docs-check.yml`) fails if the documentation drifts from the code — undocumented
tables, unmentioned crons.

The automation contract is checked too: [`scripts/pipeline_contract_check.py`](scripts/pipeline_contract_check.py)
fails CI if workflow/script wiring drifts or if a workflow-automated ETL script stops emitting
`sync_log` receipts. This contract check runs on push/PR and in a daily scheduled sweep via
`docs-check.yml`.

---

## Local development

```bash
npm install
npm run dev          # frontend at localhost:5173
```

Copy `.env.example` → `.env` with Supabase keys (and `EIA_API_KEY` for the EIA scripts).
The Python ETL under `scripts/` needs `pip install requests beautifulsoup4 python-dotenv "supabase==2.9.1"`
and the same `.env`; the scheduled crons run on GitHub Actions using repo secrets
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `EIA_API_KEY`. Optional PJM ingest also needs
`PJM_API_KEY` when enabled.

To stand up the whole thing from nothing, follow [`docs/REBUILD.md`](docs/REBUILD.md).

---

## Repo map

```
src/
  pages/             Overview, History, MapPage, Fleet, Grid, Incidents, Safety,
                     Dispatches, Scenarios, Reactor, DataExport (The Data), Sources, EmbedGap
  components/        Hook (map), GapChart, FleetOutputChart, GridMix, ReplacementMath,
                     CapacityFactor, Dispatch, HeadlineBand, ReactorTable
  lib/slug.js        reactor permalink slugs
api/                 og.js (live OG share card), rss.js (Dispatches RSS feed) — see ADR-0012
scripts/             Python ETL, the cron scripts, the watchdog, reconcile, docs_check
supabase/            table DDL + views + seeds (apply order in docs/REBUILD.md)
.github/workflows/   the 11 crons + watchdog (+ optional pjm-prices manual workflow)
docs/                INDEX, ARCHITECTURE, REBUILD, data-model, PROVENANCE, SOURCES,
                     ROADMAP, methodology, decisions/ (ADRs), history/ (V1 build log)
CLAUDE.md            working context for AI-assisted sessions (the agent's entry point)
CHANGELOG.md         how the project evolved
VERIFY.md / TESTING.md   health-pass checklist + UI walkthrough
```

---

*Built and maintained by AI agents working from `CLAUDE.md` and the docs. The data is
public records, re-plumbed — free to use and embed with attribution.*
