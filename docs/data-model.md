# Nuclear Pipeline Tracker — Data Model

Full schema for all 5 tables and 2 views. Copy DDL directly into the Supabase SQL editor.

---

## Table: `reactors`

The core entity. One row per reactor unit (a plant may have multiple units).

```sql
CREATE TABLE reactors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eia_plant_id          TEXT NOT NULL,
  unit_number           TEXT NOT NULL,
  plant_name            TEXT NOT NULL,
  operator              TEXT,
  state                 TEXT,
  iso_rto               TEXT,           -- e.g. 'PJM', 'MISO', 'ERCOT', 'CAISO', null if none
  latitude              NUMERIC(9,6),
  longitude             NUMERIC(9,6),
  capacity_mw           NUMERIC(8,2),
  commercial_operation_date DATE,
  license_expiration_date   DATE,
  status                TEXT NOT NULL DEFAULT 'operating',
                        -- 'operating' | 'shutdown' | 'decommissioning' | 'license_renewed'
  daily_status          TEXT,           -- '100% power' / '0% (offline)' / etc. Updated by cron
  daily_status_updated_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (eia_plant_id, unit_number)
);
```

**Key fields:**
- `eia_plant_id` + `unit_number` — natural key used for upserts
- `iso_rto` — enables regional filtering on the map
- `daily_status` — updated by the NRC cron each day; drives the "live" feel
- `capacity_mw` — drives pin size on the map

---

## Table: `new_reactor_projects`

SMR and new-build pipeline. ~15–20 rows, seeded manually, updated quarterly.

```sql
CREATE TABLE new_reactor_projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name          TEXT NOT NULL,
  developer             TEXT,
  reactor_type          TEXT,           -- e.g. 'AP1000', 'BWRX-300', 'Xe-100'
  state                 TEXT,
  latitude              NUMERIC(9,6),
  longitude             NUMERIC(9,6),
  capacity_mw           NUMERIC(8,2),
  target_online_year    INTEGER,
  stage                 TEXT,           -- 'early_stage' | 'nrc_review' | 'under_construction' | 'licensed'
  confidence            TEXT,           -- 'confirmed' | 'speculative'
  doe_ardp_funded       BOOLEAN DEFAULT false,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
```

**Key fields:**
- `target_online_year` — used in `gap_series` view to compute additions per year
- `confidence` — drives solid vs hatched rendering on the gap chart
- `doe_ardp_funded` — flag for potential annotation on the chart

---

## Table: `decommissioning`

One row per shut or decommissioning unit. Tracks capacity lost.

```sql
CREATE TABLE decommissioning (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reactor_id            UUID REFERENCES reactors(id),
  plant_name            TEXT NOT NULL,
  unit_number           TEXT,
  shutdown_date         DATE,
  decommission_complete_date DATE,
  capacity_mw_lost      NUMERIC(8,2),
  reason                TEXT,           -- 'license_expiration' | 'economic' | 'regulatory' | 'restart_pending'
  restart_possible      BOOLEAN DEFAULT false,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

**Example rows to seed:**
| Plant | Shutdown | Capacity MW | Notes |
|-------|----------|-------------|-------|
| Palisades | 2022 | 811 | Restart bid pending |
| Indian Point 2 | 2020 | 1028 | |
| Indian Point 3 | 2021 | 1041 | |
| Diablo Canyon 1 | deferred | 1118 | License extended |
| Diablo Canyon 2 | deferred | 1122 | License extended |

---

## Table: `license_actions`

Tracks renewals, expirations, and uprate actions per reactor unit.

```sql
CREATE TABLE license_actions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reactor_id            UUID REFERENCES reactors(id),
  action_type           TEXT NOT NULL,  -- 'initial_license' | 'first_renewal' | 'second_renewal' | 'uprate' | 'expiration'
  action_date           DATE,
  new_expiration_date   DATE,
  capacity_change_mw    NUMERIC(8,2),   -- positive for uprate, null otherwise
  nrc_docket            TEXT,
  status                TEXT,           -- 'approved' | 'pending' | 'expired'
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

---

## Table: `sync_log`

Audit trail for every automated data update. Write one row per cron run, always.

```sql
CREATE TABLE sync_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source                TEXT NOT NULL,  -- 'nrc_daily_status' | 'eia_seed' | etc.
  run_at                TIMESTAMPTZ DEFAULT now(),
  rows_updated          INTEGER,
  rows_inserted         INTEGER,
  status                TEXT NOT NULL,  -- 'success' | 'partial' | 'error'
  error_message         TEXT,
  duration_ms           INTEGER,
  notes                 TEXT
);
```

**Rule:** Every cron run writes one row here. If the cron fails, the row captures the error. This is the single source of truth for data freshness.

---

## View: `headline_numbers`

The three numbers in the headline band. Called once on page load.

```sql
CREATE OR REPLACE VIEW headline_numbers AS
SELECT
  (SELECT COALESCE(SUM(capacity_mw), 0)
   FROM reactors
   WHERE status = 'operating') AS operating_mw,

  (SELECT COALESCE(SUM(capacity_mw), 0)
   FROM reactors
   WHERE status IN ('operating', 'license_renewed')
     AND license_expiration_date <= '2035-12-31') AS retiring_by_2035_mw,

  (SELECT COALESCE(SUM(capacity_mw), 0)
   FROM new_reactor_projects
   WHERE target_online_year <= 2035
     AND confidence = 'confirmed') AS confirmed_pipeline_mw;
```

**Verification:** `operating_mw` should be ~97,000 (97 GW). If it's wildly off, check for a MW/GW unit bug in the seed data.

---

## View: `gap_series`

Year-by-year net capacity delta from now to 2045. Feeds the Gap Chart directly.

```sql
CREATE OR REPLACE VIEW gap_series AS
WITH years AS (
  SELECT generate_series(2025, 2045) AS year
),
retirements AS (
  SELECT
    EXTRACT(YEAR FROM license_expiration_date)::INT AS year,
    SUM(capacity_mw) AS retiring_mw
  FROM reactors
  WHERE status IN ('operating', 'license_renewed')
    AND license_expiration_date IS NOT NULL
  GROUP BY 1
),
additions AS (
  SELECT
    target_online_year AS year,
    SUM(capacity_mw) AS adding_mw
  FROM new_reactor_projects
  WHERE target_online_year IS NOT NULL
  GROUP BY 1
),
operating_base AS (
  SELECT SUM(capacity_mw) AS base_mw
  FROM reactors
  WHERE status = 'operating'
)
SELECT
  y.year,
  COALESCE(r.retiring_mw, 0) AS retiring_mw,
  COALESCE(a.adding_mw, 0) AS adding_mw,
  (SELECT base_mw FROM operating_base)
    - SUM(COALESCE(r.retiring_mw, 0)) OVER (ORDER BY y.year)
    + SUM(COALESCE(a.adding_mw, 0)) OVER (ORDER BY y.year) AS net_capacity_mw
FROM years y
LEFT JOIN retirements r ON r.year = y.year
LEFT JOIN additions a ON a.year = y.year
ORDER BY y.year;
```

**What to verify:** Eyeball the first few rows in the SQL editor. 2025 should be close to operating base. The line should trend down, with bumps where new builds come online.

---

## EIA Field Mapping

When seeding from the EIA API, map response fields to `reactors` columns as follows:

| EIA Field | `reactors` Column | Notes |
|-----------|-------------------|-------|
| `plantid` | `eia_plant_id` | String |
| `generatorid` | `unit_number` | |
| `plantName` | `plant_name` | |
| `entityName` | `operator` | |
| `stateid` | `state` | 2-letter code |
| `latitude` | `latitude` | May be null — patch manually |
| `longitude` | `longitude` | May be null — patch manually |
| `nameplate_capacity_mw` | `capacity_mw` | |
| `operating_year` | `commercial_operation_date` | Construct as `YYYY-01-01` if only year available |

Set `status = 'operating'` for everything from this endpoint. Shutdown status is applied manually in Session 2.
