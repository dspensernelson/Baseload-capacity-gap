-- Daily materialized reliability snapshots derived from generation_hourly.
-- Written by scripts/grid_reliability_daily.py.

CREATE TABLE IF NOT EXISTS grid_reliability_daily (
  snapshot_date   DATE NOT NULL,
  source_key      TEXT NOT NULL,
  avg_gw          NUMERIC,
  p10_gw          NUMERIC,
  p90_gw          NUMERIC,
  cv_pct          NUMERIC,
  ramp95_gw       NUMERIC,
  hours_observed  INTEGER,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (snapshot_date, source_key)
);

ALTER TABLE grid_reliability_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grid_reliability_daily public read" ON grid_reliability_daily;
CREATE POLICY "grid_reliability_daily public read" ON grid_reliability_daily FOR SELECT USING (true);


CREATE TABLE IF NOT EXISTS grid_firming_daily (
  snapshot_date                              DATE PRIMARY KEY,
  overnight_nuclear_gw                       NUMERIC,
  overnight_solar_gw                         NUMERIC,
  overnight_wind_gw                          NUMERIC,
  overnight_total_gw                         NUMERIC,
  midday_solar_gw                            NUMERIC,
  overnight_nuclear_share_pct                NUMERIC,
  low_renewables_hours_pct                   NUMERIC,
  nuclear_share_when_low_renewables_pct      NUMERIC,
  hours_observed                             INTEGER,
  updated_at                                 TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE grid_firming_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grid_firming_daily public read" ON grid_firming_daily;
CREATE POLICY "grid_firming_daily public read" ON grid_firming_daily FOR SELECT USING (true);
