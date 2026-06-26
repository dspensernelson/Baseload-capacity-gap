-- Wholesale electricity prices (LMP) by ISO hub — extends the 2 a.m. test with
-- the price story: prices spike when solar/wind drop off, the same hours
-- GridMix shows nuclear holding flat. Written forward by scripts/caiso_prices.py
-- (caiso-prices.yml, daily). Not watchdog-monitored (degrades gracefully).
--
-- Pilot scope: CAISO only (NP15/SP15 day-ahead hourly), confirmed free/public/
-- no-key via CAISO's OASIS system. `iso` and `market` are real columns, not
-- hardcoded, so adding another ISO or real-time prices later is a new script
-- writing into the same table, not a schema change. See ADR-0015.
CREATE TABLE IF NOT EXISTS wholesale_prices (
  iso             TEXT NOT NULL,        -- 'CAISO' (designed to extend: 'ERCOT', 'PJM', ...)
  hub             TEXT NOT NULL,        -- e.g. 'NP15', 'SP15'
  market          TEXT NOT NULL,        -- 'day_ahead' (designed to extend: 'real_time')
  interval_start  TIMESTAMPTZ NOT NULL,
  price_usd_mwh   NUMERIC NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (iso, hub, market, interval_start)
);
ALTER TABLE wholesale_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wholesale_prices public read" ON wholesale_prices;
CREATE POLICY "wholesale_prices public read" ON wholesale_prices FOR SELECT USING (true);
