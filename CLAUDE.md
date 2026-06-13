# Nuclear Pipeline Tracker — Claude Code Context

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
| Frontend | React + Vite + react-router | Pages: Overview (`/`), The Fleet (`/fleet`), Dispatches (`/dispatches`), reactor permalinks (`/reactor/:slug`). `vercel.json` rewrites extensionless routes to index.html so deep links survive refresh |
| Map | MapLibre GL | Free, no token required. Use OpenFreeMap or CARTO free style. |
| Charts | Recharts | Area/composed chart for the gap visualization |
| Hosting | Vercel or Netlify | Free tier, connect to GitHub repo |
| ETL (v1) | Python scripts | One-off seed scripts, run manually |
| Crons | GitHub Actions | `nrc-daily.yml` (daily 08:00, power status) · `nrc-license-monthly.yml` (monthly, license actions) · `health-check.yml` (watchdog — opens a GitHub issue if a cron breaks, closes it when healthy) · `monthly-dispatch.yml` (writes the monthly Dispatch). Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |

---

## Repo Structure

```
nuclear-pipeline-tracker/
├── CLAUDE.md                  ← you are here
├── CHECKLIST.md               ← master task checklist
├── TESTING.md                 ← usability checklist a second instance runs the user through one item at a time
├── VERIFY.md                  ← living "expected behavior + data fact-check" reference (run the 5-min pass regularly)
├── DESIGN.md                  ← architecture & data model overview
├── docs/
│   ├── VISION.md              ← long-term vision & positioning (internal; gitignored, local only)
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
├── scripts/                   ← Python ETL scripts
├── src/                       ← React app
│   ├── pages/                 ← one per route
│   │   ├── Overview.jsx       ← gap banner + numbers + map/table (/)
│   │   ├── Fleet.jsx          ← live pulse + 12-month output chart (/fleet)
│   │   ├── Dispatches.jsx     ← latest + archive of monthly reports (/dispatches)
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
| NRC license renewal pages | License actions + authoritative expiration dates | Monthly cron (`scripts/nrc_license_actions.py`) — rebuilds `license_actions`, updates `reactors.license_expiration_date` |
| DOE ARDP / NRC new reactors | SMR/new build pipeline | Manual seed, curated quarterly (intentionally not automated) |

**EIA API key:** Required. Store in `.env` as `EIA_API_KEY`. Never commit.  
**Supabase keys:** Store in `.env` as `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`. Never commit.

---

## Database Tables (7 total)

1. **`reactors`** — one row per reactor unit (operating, shutdown, decommissioning)
2. **`new_reactor_projects`** — SMR and new build pipeline (~15–20 rows, manual)
3. **`decommissioning`** — shutdown details and capacity lost
4. **`license_actions`** — license renewals, expirations, uprate actions
5. **`sync_log`** — audit trail for every cron run
6. **`daily_status_history`** — one row per reactor per NRC report date (power %); the "tape" feeding sparklines, the fleet chart, and capacity-factor math. Written forward by the daily cron, backfilled by `scripts/backfill_status_history.py`
7. **`reports`** — published monthly "Dispatches" (markdown + stats jsonb), written by `scripts/generate_dispatch.py` and rendered on the site by `Dispatch.jsx`

**Views:**
- `headline_numbers` — three summary stats (operating MW, retiring by 2035, pipeline MW)
- `gap_series` — year-by-year net capacity delta from now to 2045
- `fleet_output_series` — daily fleet output (capacity × power %) from `daily_status_history`; powers the "Last 12 Months" chart

See `docs/data-model.md` for full schema.

---

## Key Decisions (Do Not Relitigate)

- **MapLibre over Mapbox** — free, no token, no billing surface
- **Manual seed for SMR/decommissioning data** — only ~15–20 rows, moves quarterly, manual is correct
- **SQL views for aggregation** — all editorial math lives in Postgres, not in React components
- **No auth, no realtime, no payments in v1** — explicitly deferred to v2
- **Audience = curious public** — newspaper graphic aesthetic, not BI tool
- **Nuclear is the hero** — framing is "what quietly holds the lights on," not nuclear vs renewables
- **Show, don't tell** — the site presents, it never exhorts; no CTAs, no "we." Every element must survive a hostile fact-check
- **Automation ratchet** — any recurring manual task is treated as a defect; the fix is a cron or an agent (see VISION.md)
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

**Active session:** —  
**Last completed:** Post-V1 automation (June 2026) — V1 live at https://nukemap-two.vercel.app (Vercel `nukemap`, auto-deploys from `main`). Two crons: NRC daily status (08:00 UTC) and NRC license actions (monthly). `license_actions` is now fully scraper-fed from nrc.gov (no manual verification needed); detail panel shows license history + daily power. Headline "retiring by 2035" is ~12.0 GW with authoritative NRC expiration dates.  
**Blockers:** —
