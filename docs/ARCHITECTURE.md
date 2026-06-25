# Architecture

How the pieces fit, as the system runs today. For the *why* behind each choice see
[`decisions/`](decisions/) (ADRs); for the schema see [`data-model.md`](data-model.md);
for sources see [`SOURCES.md`](SOURCES.md).

---

## The one-sentence shape

Public data (NRC + EIA) → scraped by GitHub Actions crons → stored in Supabase Postgres,
where **all editorial math lives in SQL views** → read directly by a React/Vercel frontend.
No *application* server; the database *is* the API. Provenance and a reconciliation loop
keep every number honest; a watchdog keeps the crons honest.

Two narrow exceptions: `api/og.js` and `api/rss.js` are thin, read-only Vercel functions
that render a live share-card image and an RSS feed respectively — presentation artifacts
for distribution, not application logic. Both use only the public anon key, same as the
frontend. See [ADR-0012](decisions/0012-thin-distribution-functions.md).

```
 EXTERNAL SOURCES            AUTOMATION (GitHub Actions)        STORE (Supabase)         READ (Vercel)
 ────────────────            ───────────────────────────        ────────────────         ─────────────
 NRC power status    ─┐
 NRC license pages    │      nrc-daily        (08:00)           14 tables                React + Vite
 NRC event notices    ├────► nrc-license-wk   (Mon)      ──────► 4 views          ◄─────── react-router
 EIA-860M / 930       │      eia930           (6h)               (editorial math   anon   MapLibre / Recharts
 DOE / OWID / IPCC   ─┘      nrc-events       (09:00)            = views only)     key    11 tabs + permalinks
                            monthly-dispatch  (2nd)                  │                        │
                            reconcile         (weekly) ◄────────────┤  metric_lineage ──────►/sources
                            health-check      (watchdog)            sync_log (every run)
```

---

## Data flow

**Seed (once):** `scripts/seed_reactors.py` pulls the reactor inventory from EIA-860M;
`supabase/seed_curated.sql` loads the manual pipeline + decommissioning; the license cron
fills `license_actions`. See [REBUILD.md](REBUILD.md).

**Steady state (crons, no human):** each cron fetches a public source, upserts rows, and
writes a `sync_log` receipt. The daily power cron also appends to `daily_status_history`
(the append-only "tape" that everything time-series consumes).

**Read path (every page load):** the browser hits Supabase's REST API directly with the
read-only anon key (RLS allows only SELECT). It reads tables for lists/maps and **views**
for any aggregated number — React never re-aggregates.

---

## The three subsystems

### 1. The data plane (tables + crons)
14 tables in four shapes: **core entities** (`reactors`, `new_reactor_projects`,
`decommissioning`, `license_actions`), **automated feeds** (`daily_status_history`,
`generation_hourly`, `incidents`, `sync_log`), **curated reference** (`energy_safety`,
`notable_accidents`, `history_milestones`), and **the provenance pair** (`metric_lineage`,
`reconciliation_log`). Seven crons keep them fresh ([README](../README.md#the-crons)).

### 2. The editorial plane (views)
Every number a visitor sees that isn't a raw row is a **SQL view**: `headline_numbers`,
`gap_series`, `fleet_output_series`, `reactor_cf_90d`. This is the single auditable place
the math lives. Changing a number means changing a view — and its `metric_lineage` row.

### 3. The integrity plane (provenance + watchdog)
- **Provenance** — every curated row cites a source; every public number is registered in
  `metric_lineage` (definition + exact formula + primary source); the public `/sources`
  page renders it. See [PROVENANCE.md](PROVENANCE.md).
- **Reconciliation** (`reconcile.py`, weekly) — re-derives each headline *independently in
  Python* from atomic rows and compares to the live view; logs to `reconciliation_log`;
  flags drift.
- **Watchdog** (`health_check.py`, after every cron) — freshness + sanity + provenance
  completeness; opens a GitHub issue only on failure, closes it when healthy.
- **Docs self-audit** (`docs_check.py`) — the same discipline for the documentation.

---

## The frontend

React + Vite + react-router. One route per visitor question (the "tab theory" — see
[decisions/0005-tab-theory.md](decisions/0005-tab-theory.md)): 11 tabs + `/reactor/:slug`
and `/dispatches/:period` permalinks + `/embed/gap`. Components fetch through one configured
client (`src/supabase.js`); charts are Recharts; the map is MapLibre GL (no token).
`vercel.json` rewrites client routes so deep links survive a refresh, plus one explicit
rewrite (`/rss.xml` → `api/rss`) for the feed. Deployed on Vercel; push to `main` auto-deploys.

---

## Invariants (do not break)

1. **Editorial math lives in SQL views, never in React.**
2. **Every cron writes a `sync_log` row.**
3. **Every curated row cites a source; every public number has a `metric_lineage` entry.**
4. **Never prune `daily_status_history`** — it's the un-recreatable asset.
5. **The anon key is the only key in the frontend** — and the only key `api/og.js`/`api/rss.js`
   use too. Service key is server-side-script-only.
6. **`new_reactor_projects` is capacity *arriving* only** — never renewals of operating plants.
7. **If it can't update itself, it doesn't ship** — manual work is reserved for editorial judgment.
