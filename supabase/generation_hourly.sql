-- EIA-930 hourly US48 net generation by fuel type — powers the 2 a.m. grid-mix view.
-- Written forward by scripts/eia930_generation.py (eia930-generation.yml, every 6h).
-- Not watchdog-monitored (degrades gracefully if a fetch is missed).
CREATE TABLE IF NOT EXISTS generation_hourly (
  period_utc  TIMESTAMPTZ NOT NULL,
  fueltype    TEXT NOT NULL,
  mwh         NUMERIC,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (period_utc, fueltype)
);
ALTER TABLE generation_hourly ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "generation_hourly public read" ON generation_hourly;
CREATE POLICY "generation_hourly public read" ON generation_hourly FOR SELECT USING (true);
