# Data Model

The complete schema as it runs in production: **16 tables, 5 views**. Generated against
the live database. Every `CREATE TABLE` here has a matching artifact under `supabase/`
(see [REBUILD.md](REBUILD.md) for the apply order); `scripts/docs_check.py` fails if a
live table is missing from this file.

Groups: **core entities** · **automated feeds** · **provenance system** · **curated reference** · **content** · **views**.

---

## Core entities

### `reactors` — the central entity (94 rows)
One row per operating US reactor unit. Capacity & location seeded from EIA; license dates
from NRC; daily power % updated by the daily cron.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `eia_plant_id`, `unit_number` | text | natural key (`UNIQUE`), used for upserts |
| `plant_name`, `operator`, `state`, `iso_rto` | text | |
| `latitude`, `longitude` | numeric | map placement |
| `capacity_mw` | numeric | nameplate (drives pin size + headline math) |
| `commercial_operation_date`, `license_expiration_date` | date | |
| `status` | text | `operating` \| `shutdown` \| `decommissioning` \| `license_renewed` |
| `daily_status`, `daily_status_updated_at` | text/ts | latest NRC power %, set by the daily cron |
| `source`, `source_url`, `source_date`, `verified_at`, `provenance_note` | — | provenance (see below) |
| `created_at`, `updated_at` | ts | |

### `new_reactor_projects` — the pipeline (7 rows, **manual**)
SMR/new-build + restarts. **Capacity *arriving* only** — never existing plants being
renewed (that double-counts the fleet). `target_online_year` + `confidence` feed the headline & gap.
Columns: `id`, `project_name`, `developer`, `reactor_type`, `state`, `latitude`, `longitude`,
`capacity_mw`, `target_online_year`, `stage`, `confidence`, `doe_ardp_funded`, `notes`, provenance, timestamps.

### `decommissioning` — shutdown units (10 rows)
Historical closures + restart-possible flags. Columns: `id`, `reactor_id` (FK), `plant_name`,
`unit_number`, `shutdown_date`, `decommission_complete_date`, `capacity_mw_lost`, `reason`,
`restart_possible`, `notes`, provenance, `created_at`.

### `license_actions` — NRC renewals/SLRs (118 rows)
Scraper-fed. Columns: `id`, `reactor_id` (FK), `action_type`, `action_date`, `new_expiration_date`,
`capacity_change_mw`, `nrc_docket`, `status`, `notes`, provenance, `created_at`.

---

## Automated feeds

### `sync_log` — the cron audit trail (every run)
`id`, `source`, `run_at`, `rows_updated`, `rows_inserted`, `status`, `error_message`,
`duration_ms`, `notes`. **Every cron writes one row here — non-negotiable.**

### `daily_status_history` — the tape (~34k rows, append-only)
One row per reactor per NRC report date. The un-recreatable asset (never prune).
`id`, `reactor_id` (FK), `report_date`, `power_pct`, `status_text`, `recorded_at`.

### `generation_hourly` — EIA-930 grid mix (~4k rows)
`period_utc`+`fueltype` PK, `mwh`, `updated_at`. Powers the 2 a.m. view. Degrades gracefully.

### `wholesale_prices` — CAISO day-ahead hourly LMP (pilot, grows daily)
`iso`+`hub`+`market`+`interval_start` PK, `price_usd_mwh`, `updated_at`. Powers "The price of
intermittency" on The Grid. Pilot scope: CAISO only (NP15/SP15), day-ahead market only — `iso`
and `market` are real columns so another ISO or real-time prices is additive, not a schema
change. No API key needed (CAISO OASIS is public). Degrades gracefully. See
[ADR-0015](decisions/0015-caiso-pricing-pilot.md).

### `incidents` — the live NRC event wire (11 rows, grows daily)
NRC Event Notifications, plant events only (filtered to rows with a `Facility`).
`event_number` PK, `event_date`, `report_date`, `facility`, `unit`, `state`, `region`,
`rx_type`, `emergency_class`, `notification_basis`, `description`, `reactor_id` (best-effort FK),
provenance, `created_at`.

---

## Provenance system

### `metric_lineage` — every public number (24 rows)
The machine-readable spine read by `reconcile.py` and rendered on `/sources`.
`metric_key` PK, `label`, `surface`, `definition`, `formula`, `unit`, `source_object`,
`primary_source`, `primary_source_url`, `constants`, `last_value`, `last_reconciled_at`,
`reconcile_status`, `notes`, `sort_order`, `updated_at`.

### `reconciliation_log` — the reconciliation receipt (append-only)
`id`, `run_at`, `metric_key`, `our_value`, `independent_value`, `delta`, `status`, `detail`.

**Provenance columns** (on `reactors`, `new_reactor_projects`, `decommissioning`,
`license_actions`, and the curated reference tables): `source`, `source_url`, `source_date`,
`verified_at`, `provenance_note`. Completeness is watchdog-enforced.

---

## Curated reference (manual, sourced)

### `energy_safety` — deaths/TWh + emissions by source (8 rows)
`energy_source` PK, `category` (combustion|clean), `deaths_per_twh`, `ghg_co2e_per_kwh`,
`note`, `sort_order`, provenance. Source: OWID / IPCC AR5.

### `notable_accidents` — the famous accidents (4 rows)
`slug` PK, `name`, `energy_source`, `year`, `location`, `ines_level`, `deaths_low`,
`deaths_high`, `deaths_label`, `summary`, `sort_order`, provenance. Source: UNSCEAR / Japan gov / OWID.

### `history_milestones` — the History timeline (18 rows)
`slug` PK, `year`, `year_label`, `title`, `description`, `category`, `sort_order`, provenance.
Source: WNA / DOE / NRC / EIA / UNSCEAR.

### `demand_forecast` — the demand-growth assumption (1 row)
`id`, `scenario`, `baseline_year`, `baseline_twh`, `growth_rate_low`, `growth_rate_high`,
provenance, `created_at`. Feeds `demand_growth_series` — the band on the Overview gap chart.
Source: EIA AEO2026 reference case + Today in Energy (2024 baseline). See
[ADR-0014](decisions/0014-demand-growth-band.md).

---

## Content

### `reports` — Dispatches & the Regulatory Radar digest (grows monthly + weekly)
`id`, `kind`, `period`, `title`, `body` (markdown), `stats` (jsonb), `published_at`,
`unique(kind, period)`. Two `kind` values: `monthly` (the Dispatch, `period` = `'YYYY-MM'`,
written by `scripts/generate_dispatch.py`) and `weekly_radar` (the Regulatory Radar digest,
`period` = ISO week `'YYYY-Www'`, written by `scripts/generate_radar.py`). The radar's
`stats.snapshot` holds last week's `license_actions` state for diffing — see
[ADR-0013](decisions/0013-radar-snapshot-diff.md).

---

## Views (all editorial math lives here)

| View | Returns | Feeds |
|---|---|---|
| `headline_numbers` | `operating_mw`, `retiring_by_2035_mw`, `confirmed_pipeline_mw` | the three headline numbers |
| `gap_series` | per-year `retiring_mw`, `adding_mw`, `net_capacity_mw` (2025–2045) | the gap chart |
| `demand_growth_series` | per-year `demand_mw_low`, `demand_mw_high` (2025–2045) | the gap chart's demand-growth band |
| `fleet_output_series` | per-day `output_mw`, `capacity_mw`, `units_offline`, `units_reporting` | the 12-month fleet chart |
| `reactor_cf_90d` | per-unit `avg_power_90d`, `offline_days`, `days` (last 90 d) | Fleet "who ran hardest" |

Exact formulas are registered in `metric_lineage` and shown on [`/sources`](https://nukemap-two.vercel.app/sources).
**Rule:** if you change a view's formula, update its `metric_lineage` row in the same commit.
