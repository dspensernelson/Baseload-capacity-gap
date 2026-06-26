-- ============================================================
-- PROVENANCE LAYERS 2 & 3 — the metric registry + the reconciliation receipt
-- metric_lineage: one row per number shown anywhere on the site (the spine read by
-- scripts/reconcile.py and rendered on the public /sources page).
-- reconciliation_log: append-only receipt written by reconcile.py.
-- Idempotent: CREATE ... IF NOT EXISTS and INSERT ... ON CONFLICT DO UPDATE.
-- See docs/PROVENANCE.md.
-- ============================================================

CREATE TABLE IF NOT EXISTS metric_lineage (
  metric_key          TEXT PRIMARY KEY,
  label               TEXT NOT NULL,
  surface             TEXT,
  definition          TEXT NOT NULL,
  formula             TEXT NOT NULL,
  unit                TEXT,
  source_object       TEXT,
  primary_source      TEXT,
  primary_source_url  TEXT,
  constants           TEXT,
  last_value          TEXT,
  last_reconciled_at  TIMESTAMPTZ,
  reconcile_status    TEXT,
  notes               TEXT,
  sort_order          INTEGER DEFAULT 0,
  updated_at          TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE metric_lineage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metric_lineage public read" ON metric_lineage;
CREATE POLICY "metric_lineage public read" ON metric_lineage FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS reconciliation_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at             TIMESTAMPTZ DEFAULT now(),
  metric_key         TEXT,
  our_value          TEXT,
  independent_value  TEXT,
  delta              TEXT,
  status             TEXT,
  detail             TEXT
);
ALTER TABLE reconciliation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reconciliation_log public read" ON reconciliation_log;
CREATE POLICY "reconciliation_log public read" ON reconciliation_log FOR SELECT USING (true);

-- ---- Seed: one row per public number (20 metrics, 16 surfaces) -------------
-- $$-quoted so SQL fragments inside formulas stay verbatim. Re-runnable via upsert.

INSERT INTO metric_lineage
 (metric_key,label,surface,definition,formula,unit,source_object,primary_source,primary_source_url,constants,notes,sort_order) VALUES
($$operating_mw$$,$$Operating today$$,$$Overview headline / Fleet$$,
 $$Total nameplate capacity of the currently operating U.S. reactor fleet.$$,
 $$SUM(capacity_mw) FROM reactors WHERE status = 'operating'$$,$$MW$$,$$headline_numbers.operating_mw$$,
 $$EIA-860M (capacity) + NRC List of Power Reactor Units (unit count)$$,$$https://www.eia.gov/electricity/data/eia860m/$$,
 NULL,$$Nameplate, not net-summer — see nameplate_vs_net.$$,10),
($$retiring_by_2035_mw$$,$$Retiring by 2035$$,$$Overview headline / Gap-chart label$$,
 $$Nameplate capacity of operating reactors whose NRC license expires on or before 2035-12-31 and has not been renewed past it.$$,
 $$SUM(capacity_mw) FROM reactors WHERE status IN ('operating','license_renewed') AND license_expiration_date <= '2035-12-31'$$,
 $$MW$$,$$headline_numbers.retiring_by_2035_mw$$,$$NRC List of Power Reactor Units (license expiration dates)$$,
 $$https://www.nrc.gov/reactors/operating/list-power-reactor-units.html$$,NULL,
 $$Every operating reactor must carry a license date or it silently drops out (the Watts Bar bug). Watchdog-guarded. Each approved renewal should reduce this.$$,11),
($$pipeline_mw$$,$$In the pipeline$$,$$Overview headline$$,
 $$Capacity ARRIVING by 2035 from confirmed new builds and restarts (new SMRs + restarts of shut units). Excludes existing plants being renewed.$$,
 $$SUM(capacity_mw) FROM new_reactor_projects WHERE target_online_year <= 2035 AND confidence = 'confirmed'$$,
 $$MW$$,$$headline_numbers.confirmed_pipeline_mw$$,$$NRC New Reactors + DOE ARDP$$,$$https://www.nrc.gov/reactors/new-reactors.html$$,
 NULL,$$Manual, editor-curated. Renewals/SLRs must never appear here (the Diablo Canyon bug). Watchdog-guarded.$$,12),
($$gap_chart_series$$,$$The Gap (chart)$$,$$Overview gap chart$$,
 $$Year-by-year net operating capacity 2025-2045: operating base minus cumulative retirements plus cumulative additions. The amber wedge is how far net falls below the 2025 base.$$,
 $$gap_series: net = base - cumulative(retiring_mw) + cumulative(adding_mw); base = SUM(capacity_mw) operating. Chart amber gap_gw = base - net_gw.$$,
 $$series (GW)$$,$$gap_series$$,$$NRC license expirations + NRC/DOE pipeline$$,
 $$https://www.nrc.gov/reactors/operating/list-power-reactor-units.html$$,NULL,
 $$Retirements bucketed by EXTRACT(YEAR FROM license_expiration_date); additions by target_online_year.$$,13),
($$gap_2035_label$$,$$"X GW gap by 2035" annotation$$,$$Overview gap-chart marker$$,
 $$The on-chart label at the 2035 line. Equals the gross retiring_by_2035 headline (capacity losing its license by 2035) — NOT the net amber-wedge area.$$,
 $$retiring_by_2035_mw / 1000 (GapChart.jsx)$$,$$GW$$,$$headline_numbers.retiring_by_2035_mw$$,
 $$NRC List of Power Reactor Units$$,$$https://www.nrc.gov/reactors/operating/list-power-reactor-units.html$$,NULL,
 $$Intentionally gross (ignores the 2 GW pipeline): it marks what is scheduled to lose its license — the upper bound of the threat.$$,14),
($$reactor_capacity$$,$$Reactor capacity$$,$$Map / Reactor detail / Table$$,
 $$Per-unit nameplate capacity.$$,$$reactors.capacity_mw (atomic fact)$$,$$MW$$,$$reactors.capacity_mw$$,
 $$EIA-860M$$,$$https://www.eia.gov/electricity/data/eia860m/$$,NULL,NULL,20),
($$reactor_license_exp$$,$$License expiration$$,$$Map / Reactor detail / Table$$,
 $$Per-unit NRC operating-license expiration date (post-renewal where renewed).$$,
 $$reactors.license_expiration_date (atomic); renewals tracked in license_actions$$,$$date$$,$$reactors.license_expiration_date$$,
 $$NRC List of Power Reactor Units + NRC renewal$$,$$https://www.nrc.gov/reactors/operating/list-power-reactor-units.html$$,NULL,NULL,21),
($$reactor_live_mw$$,$$Live MW now$$,$$Reactor detail / Map pin color$$,
 $$Estimated instantaneous output = capacity times today NRC power percent.$$,
 $$capacity_mw * daily_status_pct / 100$$,$$MW$$,$$reactors.capacity_mw x reactors.daily_status$$,
 $$NRC Power Reactor Status Report (daily)$$,$$https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/$$,NULL,NULL,22),
($$reactor_cf_90d$$,$$90-day capacity factor$$,$$Fleet (who ran hardest) / Reactor$$,
 $$Average daily power percent over the last 90 days per unit.$$,
 $$reactor_cf_90d: round(avg(power_pct)) over report_date >= CURRENT_DATE - 90$$,$$%$$,$$reactor_cf_90d$$,
 $$NRC Power Reactor Status Report (history tape)$$,$$https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/$$,NULL,NULL,23),
($$fleet_pct_online$$,$$Percent of fleet online$$,$$Fleet right-now$$,
 $$Share of operating nameplate currently generating.$$,
 $$SUM(cap * daily_status_pct/100) / SUM(cap) over the operating fleet$$,$$%$$,$$reactors.daily_status$$,
 $$NRC Power Reactor Status Report$$,$$https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/$$,NULL,NULL,30),
($$fleet_gw_now$$,$$GW generating now$$,$$Fleet right-now$$,
 $$Instantaneous fleet output.$$,$$SUM(cap * daily_status_pct/100) / 1000$$,$$GW$$,$$reactors.daily_status$$,
 $$NRC Power Reactor Status Report$$,$$https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/$$,NULL,NULL,31),
($$fleet_units_running$$,$$Units running / offline$$,$$Fleet right-now$$,
 $$Count of operating units above 0 percent vs at 0 percent (refueling).$$,
 $$COUNT(daily_status_pct > 0) vs COUNT(= 0)$$,$$count$$,$$reactors.daily_status$$,
 $$NRC Power Reactor Status Report$$,$$https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/$$,NULL,NULL,32),
($$fleet_output_series$$,$$12-month fleet output$$,$$Fleet chart$$,
 $$Daily fleet output and capacity across the last year.$$,
 $$fleet_output_series: SUM(cap*power_pct/100) per report_date from daily_status_history$$,$$series (MW)$$,$$fleet_output_series$$,
 $$NRC Power Reactor Status Report history$$,$$https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/$$,NULL,NULL,33),
($$fleet_cf$$,$$Fleet capacity factor (~92%)$$,$$Fleet chart / context$$,
 $$Fleet output divided by nameplate capacity.$$,$$output_mw / capacity_mw (fleet_output_series)$$,$$%$$,$$fleet_output_series$$,
 $$EIA (U.S. nuclear ~92-93% CF) cross-checked against our NRC tape$$,$$https://www.eia.gov/energyexplained/nuclear/$$,NULL,NULL,34),
($$grid_mix$$,$$2 a.m. grid mix$$,$$Grid$$,
 $$U.S. Lower-48 net generation by fuel type, hourly, last 48 hours.$$,
 $$generation_hourly: SUM(mwh)/1000 GW bucketed by fueltype (NUC/COL/NG/WAT/WND/SUN...)$$,$$series (GW)$$,$$generation_hourly$$,
 $$EIA Hourly Electric Grid Monitor (EIA-930)$$,$$https://www.eia.gov/electricity/gridmonitor/$$,NULL,NULL,40),
($$grid_overnight_callout$$,$$Overnight nuclear vs solar$$,$$Grid callout$$,
 $$At the lowest-solar hour of the last 24, nuclear GW and its share of the grid, vs the midday solar peak.$$,
 $$night = argmin(solar) of last 24h; nuke_share = night.nuclear / night.total$$,$$GW / %$$,$$generation_hourly$$,
 $$EIA-930$$,$$https://www.eia.gov/electricity/gridmonitor/$$,NULL,NULL,41),
($$replace_energy_twh$$,$$Reactor annual energy$$,$$Grid replacement math$$,
 $$Annual energy of the selected reactor at the nuclear capacity factor.$$,
 $$capacity_mw * 8760 * NUCLEAR_CF / 1e6$$,$$TWh$$,$$ReplacementMath.jsx$$,
 $$EIA capacity factors (Table 6.07.B)$$,$$https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_6_07_b$$,
 $$NUCLEAR_CF=0.93; hours_per_year=8760$$,NULL,42),
($$replace_wind_solar$$,$$Wind/solar to match a reactor$$,$$Grid replacement math$$,
 $$Nameplate wind or solar needed to match one reactor annual ENERGY (not capacity or firmness).$$,
 $$windMW = cap*(0.93/0.35); solarMW = cap*(0.93/0.24); turbines = windMW/3.2; solar_sq_mi = solarMW*6/640$$,
 $$GW$$,$$ReplacementMath.jsx$$,$$EIA capacity factors (Table 6.07.B)$$,
 $$https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_6_07_b$$,
 $$NUCLEAR_CF=0.93; WIND_CF=0.35; SOLAR_CF=0.24; MW_PER_TURBINE=3.2; ACRES_PER_MW_SOLAR=6$$,
 $$Energy-only; excludes storage/transmission/land. Caveated on-page.$$,43),
($$scenarios_model$$,$$Scenario explorer$$,$$Scenarios$$,
 $$Interactive model recomputing the gap under future-renewal rate, pipeline delay, and build-out sliders. A model, not a forecast.$$,
 $$buildScenario(): retired = cap*(1-renewalRate); renewed share pushed +20yr; additions shifted by slipYears, scaled by landRate; net = operating - cumRetire + cumAdd$$,
 $$series (GW)$$,$$Scenarios.jsx (client-side)$$,$$NRC license expirations + NRC/DOE pipeline$$,
 $$https://www.nrc.gov/reactors/operating/list-power-reactor-units.html$$,
 $$defaults: renewalRate=0%, slipYears=0, landRate=100%; renewal extension=+20yr; END_YEAR=2045$$,NULL,50),
($$nameplate_vs_net$$,$$Nameplate vs net-summer (definitional)$$,$$Methodology$$,
 $$We report EIA nameplate (~101.9 GW). U.S. nuclear is also quoted ~97 GW net-summer. Both correct — different definitions.$$,
 $$nameplate (EIA-860M) vs net-summer capacity$$,$$note$$,$$methodology$$,$$EIA-860M$$,
 $$https://www.eia.gov/electricity/data/eia860m/$$,NULL,
 $$Do not treat the ~5% gap as a bug.$$,60)
ON CONFLICT (metric_key) DO UPDATE SET
 label=EXCLUDED.label, surface=EXCLUDED.surface, definition=EXCLUDED.definition, formula=EXCLUDED.formula,
 unit=EXCLUDED.unit, source_object=EXCLUDED.source_object, primary_source=EXCLUDED.primary_source,
 primary_source_url=EXCLUDED.primary_source_url, constants=EXCLUDED.constants, notes=EXCLUDED.notes,
 sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO metric_lineage
 (metric_key,label,surface,definition,formula,unit,source_object,primary_source,primary_source_url,constants,notes,sort_order) VALUES
($$grid_source_cv_30d$$,$$30-day source variability (CV)$$,$$Grid / Reliability profile$$,
 $$Coefficient of variation for each major generation source over the trailing 30 days of hourly U.S. generation.$$,
 $$grid_reliability_source_stats_30d.cv_pct = stddev_pop(gw)/avg(gw) by source bucket$$,$$%$$,
 $$grid_reliability_source_stats_30d$$,$$EIA Hourly Electric Grid Monitor (EIA-930)$$,
 $$https://www.eia.gov/electricity/gridmonitor/$$,NULL,
 $$Lower CV means flatter output profile; this is a reliability-shape metric, not a cost metric.$$,44),
($$grid_source_ramp95_30d$$,$$30-day source ramp stress (P95 abs delta)$$,$$Grid / Reliability profile$$,
 $$95th percentile absolute hour-to-hour GW change by source over the trailing 30 days.$$,
 $$grid_reliability_source_stats_30d.ramp95_gw = percentile_cont(0.95) of abs(gw_t - gw_t-1)$$,$$GW$$,
 $$grid_reliability_source_stats_30d$$,$$EIA Hourly Electric Grid Monitor (EIA-930)$$,
 $$https://www.eia.gov/electricity/gridmonitor/$$,NULL,
 $$Higher ramp stress implies more balancing burden on the rest of the system.$$,45),
($$grid_overnight_nuclear_share_30d$$,$$Overnight nuclear share (00:00-05:59 ET)$$,$$Grid / Firming snapshot$$,
 $$Average nuclear share of total U.S. generation during overnight hours, trailing 30 days.$$,
 $$grid_firming_snapshot_30d.overnight_nuclear_share_pct = 100*avg(nuclear_gw/total_gw) for ET hour 0-5$$,$$%$$,
 $$grid_firming_snapshot_30d$$,$$EIA Hourly Electric Grid Monitor (EIA-930)$$,
 $$https://www.eia.gov/electricity/gridmonitor/$$,NULL,
 $$Shows contribution when solar is structurally absent, not annual energy share.$$,46),
($$grid_nuclear_share_low_renew_30d$$,$$Nuclear share when wind+solar < 15%$$,$$Grid / Firming snapshot$$,
 $$Average nuclear share during hours where wind+solar together provide under 15% of total generation, trailing 30 days.$$,
 $$grid_firming_snapshot_30d.nuclear_share_when_low_renewables_pct$$,$$%$$,
 $$grid_firming_snapshot_30d$$,$$EIA Hourly Electric Grid Monitor (EIA-930)$$,
 $$https://www.eia.gov/electricity/gridmonitor/$$,$$low-renew threshold = 15% of total generation$$,
 $$Illustrates firming role during weak renewable periods; threshold is explicit and editable.$$,47)
ON CONFLICT (metric_key) DO UPDATE SET
 label=EXCLUDED.label, surface=EXCLUDED.surface, definition=EXCLUDED.definition, formula=EXCLUDED.formula,
 unit=EXCLUDED.unit, source_object=EXCLUDED.source_object, primary_source=EXCLUDED.primary_source,
 primary_source_url=EXCLUDED.primary_source_url, constants=EXCLUDED.constants, notes=EXCLUDED.notes,
 sort_order=EXCLUDED.sort_order, updated_at=now();
