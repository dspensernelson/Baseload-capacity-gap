# Nuclear Pipeline Tracker

**Live site: https://nukemap-two.vercel.app**

A public-facing visualization of the gap between retiring US nuclear capacity and
new build coming online — backed by real EIA and NRC data that refreshes itself,
with no one at the wheel. It shows; it doesn't editorialize.

## The three numbers

| Number | Meaning | Source |
|--------|---------|--------|
| Operating today | Sum of nameplate capacity, all operating units | EIA-860 via EIA v2 API |
| Retiring by 2035 | Capacity whose NRC operating license expires by end of 2035 | NRC license renewal records |
| In the pipeline | New build with confirmed status | NRC new reactors + DOE ARDP, manually curated |

See [docs/methodology.md](docs/methodology.md) for assumptions and caveats, and
[VERIFY.md](VERIFY.md) for the expected-behavior + data fact-check checklist.

## What's inside (six tabs)

| Tab | What it answers |
|-----|-----------------|
| **Overview** | The gap thesis — a full-bleed gap chart through 2045 + the three headline numbers |
| **Map** | Every US reactor (live-colored by power status) and new-build/restart pins, a filterable table, and a page per reactor |
| **The Fleet** | What the fleet is doing now (live pulse), a year of daily output, and 90-day "who ran hardest" lists |
| **The Grid** | Nuclear vs. the whole grid — the "2 a.m. test" (hourly generation mix) and the capacity-vs-energy replacement math |
| **Dispatches** | An auto-written monthly report + a regulatory radar of NRC license activity |
| **Scenarios** | A drag-the-levers explorer: change renewal/pipeline assumptions and watch the gap recompute live |

## Architecture

- **Database** — Supabase (Postgres). All editorial math lives in SQL views
  (`headline_numbers`, `gap_series`, `fleet_output_series`, `reactor_cf_90d`); React only renders.
- **Frontend** — React + Vite + react-router (tabbed pages + reactor permalinks),
  MapLibre GL (map), Recharts (charts). Deployed on Vercel; every push to `main`
  auto-deploys. `vercel.json` rewrites client routes so deep links survive refresh.
- **Automation** — GitHub Actions crons keep the data fresh with zero manual
  upkeep, and a watchdog makes sure they actually run. Every run writes an audit
  row to `sync_log`.

| Cron | Schedule | What it does |
|------|----------|--------------|
| `nrc-daily.yml` | daily 08:00 UTC | NRC power reactor status → `reactors.daily_status` (94 units) + appends to `daily_status_history` |
| `nrc-license-monthly.yml` | monthly, 1st | Scrapes NRC renewal pages → rebuilds `license_actions`, pushes authoritative expiration dates into `reactors` |
| `eia930-generation.yml` | every 6 h | EIA-930 hourly US generation by fuel type → `generation_hourly` (the 2 a.m. view) |
| `monthly-dispatch.yml` | monthly, 2nd | Drafts the plain-English Dispatch → `reports` |
| `health-check.yml` | after each cron + daily | Watchdog: checks freshness/sanity, opens a GitHub issue only if something breaks, closes it when healthy |

What stays manual by design: `new_reactor_projects` (~10–20 rows of editorial
judgment about which SMR/new-build projects are credible; revisit quarterly).

## Local development

```bash
npm install
npm run dev          # frontend at localhost:5173
```

Copy `.env.example` to `.env` and fill in the Supabase keys (and `EIA_API_KEY`
for the EIA scripts). The Python ETL under `scripts/` needs
`pip install requests python-dotenv supabase==2.9.1` and the same `.env`; the
crons run them on GitHub Actions using repo secrets `SUPABASE_URL`,
`SUPABASE_SERVICE_KEY`, and `EIA_API_KEY`.

`supabase/*.sql` holds the table DDL and views; `scripts/seed_reactors.py` seeds
the reactor inventory from the EIA API, and `scripts/backfill_status_history.py`
backfills the trailing year of daily power data.

## Repo map

```
src/
  pages/                Overview, MapPage, Fleet, Grid, Dispatches, Scenarios, Reactor
  components/           Hook (map), GapChart, FleetOutputChart, GridMix, ReplacementMath,
                        CapacityFactor, Dispatch, HeadlineBand, ReactorTable
  lib/slug.js           reactor permalink slugs
scripts/                Python ETL + crons' scripts + the watchdog
supabase/               table DDL + views
.github/workflows/      the crons + watchdog
docs/                   data model, methodology, session build log
CLAUDE.md               working context for AI-assisted sessions
VERIFY.md / TESTING.md  health-pass checklist + UI walkthrough
```
