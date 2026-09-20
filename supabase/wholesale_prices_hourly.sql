-- Hourly rollup of wholesale_prices real-time rows older than the retention window.
--
-- Why: real-time feeds write 5-minute intervals (NYISO alone is ~70% of the
-- table), growing ~9 MB/week against Supabase's 500 MB free-tier cap. The site
-- only ever reads the last 48 hours at full resolution (WholesalePrices.jsx), so
-- older real-time rows are rolled up to one row per hour instead of kept forever.
--
-- Min and max are kept alongside the average on purpose: the price story is the
-- evening spike, and an average alone would flatten exactly the hours it is about.
-- Day-ahead rows are already hourly (and tiny) and are never rolled up.
--
-- Written by rollup_wholesale_prices() via scripts/rollup_wholesale_prices.py
-- (wholesale-rollup.yml, weekly). Watchdog-monitored (scripts/health_check.py).
CREATE TABLE IF NOT EXISTS wholesale_prices_hourly (
  iso                TEXT        NOT NULL,
  hub                TEXT        NOT NULL,
  market             TEXT        NOT NULL,   -- 'real_time' (day-ahead is never rolled up)
  hour_start         TIMESTAMPTZ NOT NULL,   -- UTC hour boundary
  avg_price_usd_mwh  NUMERIC     NOT NULL,   -- mean of the n_intervals raw prices
  min_price_usd_mwh  NUMERIC     NOT NULL,
  max_price_usd_mwh  NUMERIC     NOT NULL,
  n_intervals        INTEGER     NOT NULL CHECK (n_intervals > 0),
  rolled_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (iso, hub, market, hour_start)
);
ALTER TABLE wholesale_prices_hourly ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wholesale_prices_hourly public read" ON wholesale_prices_hourly;
CREATE POLICY "wholesale_prices_hourly public read" ON wholesale_prices_hourly FOR SELECT USING (true);

-- One statement does both halves: DELETE ... RETURNING feeds the aggregate, so
-- every raw row removed is provably a row that was counted (and if anything
-- fails, neither table changes). The cutoff is floored to a whole hour so an hour
-- is never split between raw and rolled. On conflict (a late row for an hour that
-- was already rolled) the aggregate is merged, not overwritten.
CREATE OR REPLACE FUNCTION public.rollup_wholesale_prices(retain_days integer DEFAULT 30)
RETURNS TABLE (raw_rows_removed bigint, hour_rows_written bigint, cutoff timestamptz)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cutoff_ts timestamptz;
BEGIN
  IF retain_days < 3 THEN
    RAISE EXCEPTION 'retain_days must be >= 3 (the site reads the last 48h at full resolution)';
  END IF;
  cutoff_ts := to_timestamp(floor(extract(epoch FROM (now() - make_interval(days => retain_days))) / 3600) * 3600);

  RETURN QUERY
  WITH del AS (
    DELETE FROM wholesale_prices
     WHERE market = 'real_time' AND interval_start < cutoff_ts
    RETURNING wholesale_prices.iso, wholesale_prices.hub, wholesale_prices.market,
              wholesale_prices.interval_start, wholesale_prices.price_usd_mwh
  ), agg AS (
    SELECT d.iso, d.hub, d.market,
           to_timestamp(floor(extract(epoch FROM d.interval_start) / 3600) * 3600) AS hour_start,
           avg(d.price_usd_mwh) AS avg_p, min(d.price_usd_mwh) AS min_p, max(d.price_usd_mwh) AS max_p,
           count(*)::int AS n
      FROM del d
     GROUP BY 1, 2, 3, 4
  ), ins AS (
    INSERT INTO wholesale_prices_hourly AS h
           (iso, hub, market, hour_start, avg_price_usd_mwh, min_price_usd_mwh, max_price_usd_mwh, n_intervals)
    SELECT iso, hub, market, hour_start, avg_p, min_p, max_p, n FROM agg
    ON CONFLICT (iso, hub, market, hour_start) DO UPDATE SET
      avg_price_usd_mwh = (h.avg_price_usd_mwh * h.n_intervals + EXCLUDED.avg_price_usd_mwh * EXCLUDED.n_intervals)
                          / (h.n_intervals + EXCLUDED.n_intervals),
      min_price_usd_mwh = LEAST(h.min_price_usd_mwh, EXCLUDED.min_price_usd_mwh),
      max_price_usd_mwh = GREATEST(h.max_price_usd_mwh, EXCLUDED.max_price_usd_mwh),
      n_intervals       = h.n_intervals + EXCLUDED.n_intervals,
      rolled_at         = now()
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM del), (SELECT count(*) FROM ins), cutoff_ts;
END;
$$;

-- Server-side only: this deletes rows, so it is callable with the service key
-- (the cron) and never with the public anon key.
REVOKE ALL ON FUNCTION public.rollup_wholesale_prices(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_wholesale_prices(integer) TO service_role;

-- Public read-only. RLS already blocks writes (SELECT-only policy), but Supabase's
-- default grants leave anon/authenticated holding INSERT/UPDATE/DELETE; remove them so
-- the table is safe by privilege, not only by policy.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.wholesale_prices_hourly FROM anon, authenticated;
