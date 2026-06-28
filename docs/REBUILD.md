# REBUILD — from zero to live

How to recreate the entire Baseload — The Capacity Gap from this repo alone. If you have
only the repo and the four secrets, this is everything. Tested against the production
stack: Supabase (Postgres) + Vercel + GitHub Actions, all free tier.

> **The golden rule:** apply the `supabase/*.sql` files **in the order below**. They are
> modular (each maps to how the schema actually grew), and order matters — views depend
> on tables, and the provenance backfill depends on rows existing.

---

## 0. Prerequisites

- A **Supabase** project (free) → gives you `SUPABASE_URL`, a service key, and an anon key.
- A **Vercel** account linked to a fork of this repo.
- An **EIA API key** (free): https://www.eia.gov/opendata/register.php
- Local: Node 18+, Python 3.11, `pip install requests beautifulsoup4 python-dotenv "supabase==2.9.1"`.
- A local `.env` (copy `.env.example`) with `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `EIA_API_KEY`.

---

## 1. Schema — apply SQL in this exact order

Run each in the Supabase SQL editor (or `psql`). All are idempotent (`IF NOT EXISTS` / `ON CONFLICT`).

| # | File | Creates |
|---|------|---------|
| 1 | `supabase/schema.sql` | core tables: `reactors`, `new_reactor_projects`, `decommissioning`, `license_actions`, `sync_log` + views `headline_numbers`, `gap_series` |
| 2 | `supabase/daily_status_history.sql` | `daily_status_history` (the tape) |
| 3 | `supabase/reports.sql` | `reports` (Dispatches) |
| 4 | `supabase/generation_hourly.sql` | `generation_hourly` (EIA-930) |
| 5 | `supabase/grid_reliability_daily.sql` | `grid_reliability_daily`, `grid_firming_daily` |
| 6 | `supabase/fleet_output_series.sql` | view (needs `daily_status_history` + `reactors`) |
| 7 | `supabase/reactor_cf_90d.sql` | view (needs `daily_status_history` + `reactors`) |
| 8 | `supabase/grid_reliability_views.sql` | views for 30-day reliability and firming snapshot |
| 9 | `supabase/metric_lineage.sql` | `metric_lineage` + `reconciliation_log` + the registry seed |
| 10 | `supabase/safety_incidents.sql` | `energy_safety`, `notable_accidents`, `incidents` + reference seeds |
| 11 | `supabase/history.sql` | `history_milestones` + timeline seed |

(`supabase/provenance.sql` is applied in step 2, after rows exist — it adds the provenance
columns *and* backfills them.)

---

## 2. Seed the data

1. **Reactor inventory** — `python scripts/seed_reactors.py` → populates `reactors` (~94 units) from the EIA API.
2. **Curated tables** — apply `supabase/seed_curated.sql` → `new_reactor_projects` + `decommissioning`.
3. **License actions** — apply `supabase/seed_license_actions.sql`, *or* run the license cron once (it rebuilds `license_actions` and pushes authoritative expiration dates into `reactors`). The cron is the source of truth.
4. **Provenance** — apply `supabase/provenance.sql` → adds the `source`/`source_url`/`verified_at`/… columns and backfills every curated row with its source. (Re-runnable; guards on `source IS NULL`.)
5. **History tape** *(optional but recommended)* — `python scripts/backfill_status_history.py` backfills the trailing year of daily power into `daily_status_history`. This data is **impossible to backfill later** — start it as early as possible.

After this, `SELECT * FROM headline_numbers;` should return ~102 GW operating / ~13 GW retiring / ~2 GW pipeline.

---

## 3. Secrets & environment

- **GitHub repo secrets** (Settings → Secrets → Actions): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `EIA_API_KEY`.
- **Vercel env vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the anon key — safe to expose; RLS is read-only).

Never put the service key in Vercel/frontend. See [decisions/0009-anon-key-frontend.md](decisions/0009-anon-key-frontend.md).

---

## 4. Deploy the frontend

Connect the repo to Vercel. Every push to `main` auto-deploys. `vercel.json` rewrites
client routes to `index.html` so deep links (`/reactor/...`, `/sources`) survive refresh.
`npm run build` locally first to confirm it compiles.

---

## 5. Turn on the automation (11 crons)

The workflows in `.github/workflows/` run on schedule once secrets exist. Trigger each once
via **workflow_dispatch** to populate live data immediately:

`nrc-daily` · `nrc-license-weekly` · `eia930-generation` · `nrc-events` · `monthly-dispatch`
→ then `reconcile` and `health-check` to validate. (Schedules + purposes: see [README](../README.md#the-crons).)

---

## 6. Verify it's real

```bash
python scripts/reconcile.py      # every headline re-derives from atomic rows, Δ 0.00
python scripts/health_check.py   # freshness + sanity + provenance completeness → PASS
python scripts/docs_check.py     # docs match the code
```

Then walk the 5-minute pass in [VERIFY.md](../VERIFY.md) and confirm `/sources` shows a
green "Last reconciled" badge. You now have the whole institution, running itself.
