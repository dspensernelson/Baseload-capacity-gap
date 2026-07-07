-- Baseload — The Capacity Gap — Full Schema
-- Run this in Supabase SQL editor to recreate the database from scratch.

-- ============================================================
-- TABLE: reactors
-- ============================================================
CREATE TABLE reactors (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eia_plant_id              TEXT NOT NULL,
  unit_number               TEXT NOT NULL,
  plant_name                TEXT NOT NULL,
  operator                  TEXT,
  state                     TEXT,
  iso_rto                   TEXT,
  latitude                  NUMERIC(9,6),
  longitude                 NUMERIC(9,6),
  capacity_mw               NUMERIC(8,2),
  commercial_operation_date DATE,
  license_expiration_date   DATE,
  status                    TEXT NOT NULL DEFAULT 'operating',
  daily_status              TEXT,
  daily_status_updated_at   TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  UNIQUE (eia_plant_id, unit_number)
);

-- ============================================================
-- TABLE: new_reactor_projects
-- ============================================================
CREATE TABLE new_reactor_projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name          TEXT NOT NULL,
  developer             TEXT,
  reactor_type          TEXT,
  state                 TEXT,
  latitude              NUMERIC(9,6),
  longitude             NUMERIC(9,6),
  capacity_mw           NUMERIC(8,2),
  target_online_year    INTEGER,
  stage                 TEXT,
  confidence            TEXT,
  doe_ardp_funded       BOOLEAN DEFAULT false,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: decommissioning
-- ============================================================
CREATE TABLE decommissioning (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reactor_id                 UUID REFERENCES reactors(id),
  plant_name                 TEXT NOT NULL,
  unit_number                TEXT,
  shutdown_date              DATE,
  decommission_complete_date DATE,
  capacity_mw_lost           NUMERIC(8,2),
  reason                     TEXT,
  restart_possible           BOOLEAN DEFAULT false,
  notes                      TEXT,
  created_at                 TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: license_actions
-- ============================================================
CREATE TABLE license_actions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reactor_id          UUID REFERENCES reactors(id),
  action_type         TEXT NOT NULL,
  action_date         DATE,
  new_expiration_date DATE,
  capacity_change_mw  NUMERIC(8,2),
  nrc_docket          TEXT,
  status              TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: sync_log
-- ============================================================
CREATE TABLE sync_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT NOT NULL,
  run_at        TIMESTAMPTZ DEFAULT now(),
  rows_updated  INTEGER,
  rows_inserted INTEGER,
  status        TEXT NOT NULL,
  error_message TEXT,
  duration_ms   INTEGER,
  notes         TEXT
);

-- ============================================================
-- VIEW: headline_numbers
-- ============================================================
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

-- ============================================================
-- VIEW: gap_series
-- ============================================================
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
