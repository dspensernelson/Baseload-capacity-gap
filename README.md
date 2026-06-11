# Nuclear Pipeline Tracker

**Live site: https://nukemap-two.vercel.app**

A public-facing visualization of the gap between retiring US nuclear capacity and
new build coming online. Three screens: a US reactor map (the Hook), a gap chart
through 2045 (the thesis), and a filterable reactor table — backed by real EIA and
NRC data that refreshes itself.

## The three numbers

| Number | Meaning | Source |
|--------|---------|--------|
| Operating today | Sum of nameplate capacity, all operating units | EIA-860 via EIA v2 API |
| Retiring by 2035 | Capacity whose NRC operating license expires by end of 2035 | NRC license renewal records |
| In the pipeline | New build with confirmed status targeting ≤ 2035 | NRC new reactors + DOE ARDP, manually curated |

See [docs/methodology.md](docs/methodology.md) for assumptions and caveats, and
[docs/VISION.md](docs/VISION.md) for where this project is headed long-term.

## Architecture

- **Database** — Supabase (Postgres). All editorial math lives in SQL views
  (`headline_numbers`, `gap_series`); React only renders.
- **Frontend** — React + Vite, MapLibre GL (map), Recharts (gap chart).
  Deployed on Vercel; every push to `main` auto-deploys.
- **Automation** — two GitHub Actions crons keep the data fresh with zero
  manual upkeep. Every run writes an audit row to `sync_log`.

| Cron | Schedule | What it does |
|------|----------|--------------|
| `nrc-daily.yml` | daily 08:00 UTC | Parses NRC's power reactor status file; updates `reactors.daily_status` (~92 units) |
| `nrc-license-monthly.yml` | monthly, 1st 09:00 UTC | Scrapes NRC license renewal pages; rebuilds `license_actions` and pushes authoritative expiration dates into `reactors` |

What stays manual by design: `new_reactor_projects` (~10–20 rows of editorial
judgment about which SMR/new-build projects are credible; revisit quarterly).

## Local development

```bash
npm install
npm run dev          # frontend at localhost:5173
```

Copy `.env.example` to `.env` and fill in the Supabase keys. The Python ETL
scripts under `scripts/` need `pip install requests python-dotenv supabase==2.9.1`
and the same `.env`; the crons run them on GitHub Actions using repo secrets
`SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.

`supabase/schema.sql` recreates the database from scratch;
`scripts/seed_reactors.py` seeds the reactor inventory from the EIA API.

## Repo map

```
src/                    React app (App.jsx, components/Hook|GapChart|ReactorTable|HeadlineBand)
scripts/                Python ETL: seed_reactors, nrc_daily_status, nrc_license_actions
supabase/schema.sql     full DDL incl. views
.github/workflows/      the two crons
docs/                   data model, methodology, session-by-session build log
CLAUDE.md               working context for AI-assisted sessions
```
