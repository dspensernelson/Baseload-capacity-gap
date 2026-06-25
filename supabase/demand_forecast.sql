-- ============================================================
-- demand_forecast — the EIA AEO reference-case demand-growth assumption
-- behind the "implied new firm capacity" band on the Overview gap chart.
-- Curated, not scraped: AEO is published ~annually, this is a quarterly-or-
-- slower editorial refresh, same cadence class as new_reactor_projects.
-- See ADR-0014 for the exact conversion formula.
-- ============================================================

CREATE TABLE IF NOT EXISTS demand_forecast (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario         TEXT NOT NULL DEFAULT 'reference',
  baseline_year    INTEGER NOT NULL,
  baseline_twh     NUMERIC NOT NULL,   -- actual US electricity sales, baseline_year
  growth_rate_low  NUMERIC NOT NULL,   -- annual, e.g. 0.009 = 0.9%/yr
  growth_rate_high NUMERIC NOT NULL,   -- annual, e.g. 0.016 = 1.6%/yr
  source TEXT, source_url TEXT, source_date DATE, verified_at TIMESTAMPTZ, provenance_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE demand_forecast ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "demand_forecast public read" ON demand_forecast;
CREATE POLICY "demand_forecast public read" ON demand_forecast FOR SELECT USING (true);
GRANT SELECT ON demand_forecast TO anon, authenticated;

-- demand_growth_series — year-by-year low/high implied new FIRM capacity (MW)
-- the demand growth requires above the baseline year, using the same ~90%
-- capacity-factor yardstick already disclosed in ReplacementMath.jsx. This is
-- NOT a claim that nuclear alone must cover this growth — it's the same firm-
-- capacity exchange rate used everywhere else on the site, applied for scale.
CREATE OR REPLACE VIEW demand_growth_series AS
SELECT
  y.year,
  ((df.baseline_twh * power(1 + df.growth_rate_low,  y.year - df.baseline_year) - df.baseline_twh) * 1e6)
    / (8760 * 0.90) AS demand_mw_low,
  ((df.baseline_twh * power(1 + df.growth_rate_high, y.year - df.baseline_year) - df.baseline_twh) * 1e6)
    / (8760 * 0.90) AS demand_mw_high
FROM generate_series(2025, 2045) AS y(year)
CROSS JOIN (SELECT * FROM demand_forecast WHERE scenario = 'reference' ORDER BY created_at DESC LIMIT 1) df;

GRANT SELECT ON demand_growth_series TO anon, authenticated;

-- Seed: EIA AEO2026 reference case (released April 2026), baselined to the
-- last actual full year (2024). Idempotent on (scenario, baseline_year).
INSERT INTO demand_forecast (scenario, baseline_year, baseline_twh, growth_rate_low, growth_rate_high,
  source, source_url, source_date, verified_at, provenance_note)
SELECT 'reference', 2024, 4430, 0.009, 0.016,
  'EIA Annual Energy Outlook 2026 + Today in Energy',
  'https://www.eia.gov/outlooks/aeo/',
  '2026-04-08', now(),
  'AEO2026 reference case: total US electricity consumption growing 0.9-1.6%/yr through 2050, '
  || 'citing data centers as a major factor. Baseline: 4,430 TWh actual US electricity sales in 2024 '
  || '(eia.gov/todayinenergy/detail.php?id=65264), an all-time high ending two decades of flat demand.'
WHERE NOT EXISTS (
  SELECT 1 FROM demand_forecast WHERE scenario = 'reference' AND baseline_year = 2024
);

-- metric_lineage entry — the band's exact formula, registered like every other
-- public number (see docs/PROVENANCE.md). reconcile_status='documented' because
-- this is sourced from an external EIA forecast, not re-derived from our own
-- atomic rows, so reconcile.py has nothing to independently recompute here.
INSERT INTO metric_lineage
 (metric_key,label,surface,definition,formula,unit,source_object,primary_source,primary_source_url,constants,notes,reconcile_status,sort_order) VALUES
($$demand_growth_gw$$,$$Demand growth (implied new firm capacity)$$,$$Overview gap chart$$,
 $$How much new firm (~90% capacity-factor) generation nationwide electricity demand growth implies, above the 2024 baseline. Not a claim nuclear alone covers it — same firm-capacity yardstick as Replacement Math, shown for scale.$$,
 $$(baseline_twh * (1+growth_rate)^(year-baseline_year) - baseline_twh) * 1e6 / (8760 * 0.90), low/high at growth_rate 0.9%/1.6%$$,
 $$MW$$,$$demand_growth_series.demand_mw_low / demand_mw_high$$,
 $$EIA Annual Energy Outlook 2026 (reference case) + EIA Today in Energy (2024 baseline)$$,
 $$https://www.eia.gov/outlooks/aeo/$$,
 $$Capacity factor 0.90 (nuclear-like firm generation), matching ReplacementMath.jsx$$,
 $$Curated, annual-refresh cadence (AEO is published ~yearly). See ADR-0014.$$,
 $$documented$$,15)
ON CONFLICT (metric_key) DO UPDATE SET
  label=EXCLUDED.label, surface=EXCLUDED.surface, definition=EXCLUDED.definition, formula=EXCLUDED.formula,
  unit=EXCLUDED.unit, source_object=EXCLUDED.source_object, primary_source=EXCLUDED.primary_source,
  primary_source_url=EXCLUDED.primary_source_url, constants=EXCLUDED.constants, notes=EXCLUDED.notes,
  reconcile_status=EXCLUDED.reconcile_status, sort_order=EXCLUDED.sort_order, updated_at=now();
