-- Grid reliability views derived from generation_hourly (EIA-930).
-- These are read-only editorial math layers for The Grid page.

CREATE OR REPLACE VIEW grid_reliability_source_stats_30d AS
WITH hourly AS (
  SELECT
    period_utc,
    CASE
      WHEN fueltype = 'NUC' THEN 'nuclear'
      WHEN fueltype = 'COL' THEN 'coal'
      WHEN fueltype = 'NG' THEN 'gas'
      WHEN fueltype = 'WAT' THEN 'hydro'
      WHEN fueltype IN ('WND', 'WNB') THEN 'wind'
      WHEN fueltype IN ('SUN', 'SNB') THEN 'solar'
      ELSE 'other'
    END AS source_key,
    SUM(mwh)::numeric / 1000.0 AS gw
  FROM generation_hourly
  WHERE period_utc >= now() - INTERVAL '30 days'
  GROUP BY 1, 2
),
ramped AS (
  SELECT
    source_key,
    period_utc,
    gw,
    ABS(gw - LAG(gw) OVER (PARTITION BY source_key ORDER BY period_utc)) AS abs_delta_gw
  FROM hourly
)
SELECT
  source_key,
  ROUND(AVG(gw), 2) AS avg_gw,
  ROUND(MIN(gw), 2) AS min_gw,
  ROUND(MAX(gw), 2) AS max_gw,
  ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY gw), 2) AS p10_gw,
  ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY gw), 2) AS p90_gw,
  ROUND((STDDEV_POP(gw) / NULLIF(AVG(gw), 0)) * 100.0, 1) AS cv_pct,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY COALESCE(abs_delta_gw, 0)), 2) AS ramp95_gw,
  COUNT(*)::integer AS hours_observed
FROM ramped
GROUP BY source_key;


CREATE OR REPLACE VIEW grid_firming_snapshot_30d AS
WITH hourly AS (
  SELECT
    period_utc,
    CASE
      WHEN fueltype = 'NUC' THEN 'nuclear'
      WHEN fueltype = 'COL' THEN 'coal'
      WHEN fueltype = 'NG' THEN 'gas'
      WHEN fueltype = 'WAT' THEN 'hydro'
      WHEN fueltype IN ('WND', 'WNB') THEN 'wind'
      WHEN fueltype IN ('SUN', 'SNB') THEN 'solar'
      ELSE 'other'
    END AS source_key,
    SUM(mwh)::numeric / 1000.0 AS gw
  FROM generation_hourly
  WHERE period_utc >= now() - INTERVAL '30 days'
  GROUP BY 1, 2
),
totals AS (
  SELECT
    period_utc,
    SUM(gw) FILTER (WHERE source_key = 'nuclear') AS nuclear_gw,
    SUM(gw) FILTER (WHERE source_key = 'wind') AS wind_gw,
    SUM(gw) FILTER (WHERE source_key = 'solar') AS solar_gw,
    SUM(gw) AS total_gw
  FROM hourly
  GROUP BY period_utc
),
annotated AS (
  SELECT
    period_utc,
    EXTRACT(HOUR FROM (period_utc AT TIME ZONE 'America/New_York'))::integer AS et_hour,
    COALESCE(nuclear_gw, 0) AS nuclear_gw,
    COALESCE(wind_gw, 0) AS wind_gw,
    COALESCE(solar_gw, 0) AS solar_gw,
    COALESCE(total_gw, 0) AS total_gw,
    COALESCE(wind_gw, 0) + COALESCE(solar_gw, 0) AS renewables_gw
  FROM totals
  WHERE COALESCE(total_gw, 0) > 0
)
SELECT
  COUNT(*)::integer AS hours_observed,
  ROUND(AVG(nuclear_gw) FILTER (WHERE et_hour BETWEEN 0 AND 5), 2) AS overnight_nuclear_gw,
  ROUND(AVG(solar_gw) FILTER (WHERE et_hour BETWEEN 0 AND 5), 2) AS overnight_solar_gw,
  ROUND(AVG(wind_gw) FILTER (WHERE et_hour BETWEEN 0 AND 5), 2) AS overnight_wind_gw,
  ROUND(AVG(total_gw) FILTER (WHERE et_hour BETWEEN 0 AND 5), 2) AS overnight_total_gw,
  ROUND(AVG(solar_gw) FILTER (WHERE et_hour BETWEEN 11 AND 15), 2) AS midday_solar_gw,
  ROUND(100.0 * AVG(nuclear_gw / NULLIF(total_gw, 0)) FILTER (WHERE et_hour BETWEEN 0 AND 5), 1) AS overnight_nuclear_share_pct,
  ROUND(100.0 * AVG((renewables_gw / NULLIF(total_gw, 0)) < 0.15::numeric), 1) AS low_renewables_hours_pct,
  ROUND(
    100.0 * AVG(
      CASE
        WHEN (renewables_gw / NULLIF(total_gw, 0)) < 0.15::numeric THEN nuclear_gw / NULLIF(total_gw, 0)
        ELSE NULL
      END
    ),
    1
  ) AS nuclear_share_when_low_renewables_pct
FROM annotated;
