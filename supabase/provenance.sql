-- ============================================================
-- PROVENANCE LAYER 1 — per-row source receipts
-- Additive + nullable columns on the four hand-curated tables, plus the backfill
-- that stamps every existing row with its primary source. Idempotent: the ALTERs
-- use IF NOT EXISTS and the UPDATEs guard on "source IS NULL", so re-running is safe.
-- See docs/PROVENANCE.md for the why.
-- ============================================================

ALTER TABLE reactors
  ADD COLUMN IF NOT EXISTS source          TEXT,
  ADD COLUMN IF NOT EXISTS source_url      TEXT,
  ADD COLUMN IF NOT EXISTS source_date     DATE,
  ADD COLUMN IF NOT EXISTS verified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provenance_note TEXT;

ALTER TABLE new_reactor_projects
  ADD COLUMN IF NOT EXISTS source          TEXT,
  ADD COLUMN IF NOT EXISTS source_url      TEXT,
  ADD COLUMN IF NOT EXISTS source_date     DATE,
  ADD COLUMN IF NOT EXISTS verified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provenance_note TEXT;

ALTER TABLE decommissioning
  ADD COLUMN IF NOT EXISTS source          TEXT,
  ADD COLUMN IF NOT EXISTS source_url      TEXT,
  ADD COLUMN IF NOT EXISTS source_date     DATE,
  ADD COLUMN IF NOT EXISTS verified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provenance_note TEXT;

ALTER TABLE license_actions
  ADD COLUMN IF NOT EXISTS source          TEXT,
  ADD COLUMN IF NOT EXISTS source_url      TEXT,
  ADD COLUMN IF NOT EXISTS source_date     DATE,
  ADD COLUMN IF NOT EXISTS verified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provenance_note TEXT;

-- ---- Backfill: bulk tables -------------------------------------------------

UPDATE reactors SET
  source='EIA-860M', source_url='https://www.eia.gov/electricity/data/eia860m/', verified_at=now(),
  provenance_note='Unit identity, nameplate capacity (MW) and location from EIA-860M operating-generator inventory. License expiration date is NRC-sourced (NRC List of Power Reactor Units) and tracked per-action in license_actions. Daily power % from the NRC Power Reactor Status Report (daily cron).'
WHERE source IS NULL;

UPDATE license_actions SET
  source='NRC-renewal', source_url='https://www.nrc.gov/reactors/operating/licensing/renewal/applications.html', verified_at=now(),
  provenance_note='Scraped from NRC license-renewal program pages by nrc_license_actions.py (monthly cron). new_expiration_date is the NRC-authorized license expiration date.'
WHERE action_type IN ('license_renewal','subsequent_license_renewal') AND source IS NULL;

UPDATE license_actions SET
  source='NRC-renewal', source_url='https://www.nrc.gov/reactors/operating/licensing/renewal/subsequent-license-renewal.html', verified_at=now(),
  provenance_note='Subsequent (80-year) license renewal under NRC review. Source: NRC SLR program page.'
WHERE action_type='subsequent_license_renewal' AND status='under_review';

UPDATE license_actions SET
  source='NRC', source_url='https://www.nrc.gov/reactors/operating.html', verified_at=now(),
  provenance_note='NRC restart reauthorization. Docket tracked in nrc_docket.'
WHERE action_type='restart_authorization' AND source IS NULL;

UPDATE decommissioning SET
  source='NRC-decommissioning', source_url='https://www.nrc.gov/info-finder/decommissioning/power-reactor/', verified_at=now(),
  provenance_note='Shutdown unit per NRC decommissioning info-finder. capacity_mw_lost is the pre-shutdown EIA nameplate. Units flagged restart_possible (TMI-1, Palisades) also appear in new_reactor_projects as capacity arriving — intentional, not a double-count of the operating fleet.'
WHERE source IS NULL;

-- ---- Backfill: new_reactor_projects (per-project, highest-risk manual rows) --

UPDATE new_reactor_projects SET source='NRC-new-reactors / DOE-ARDP', source_url='https://www.nrc.gov/reactors/new-reactors.html', verified_at=now(),
  provenance_note='Kairos Hermes demo, Oak Ridge TN. NRC construction permit issued 2023; DOE ARDP risk-reduction award. Capacity per Kairos Power design spec.'
WHERE project_name='Kairos Hermes Demo';

UPDATE new_reactor_projects SET source='NRC / DOE', source_url='https://www.nrc.gov/reactors/operating.html', verified_at=now(),
  provenance_note='Holtec restart of Palisades (Covert MI), shut 2022. NRC restart reauthorization in progress; DOE loan guarantee conditional commitment 2023. Capacity = pre-shutdown nameplate. Also present in decommissioning (the shutdown event); here it counts as capacity ARRIVING back.'
WHERE project_name='Palisades Restart';

UPDATE new_reactor_projects SET source='NRC / Constellation', source_url='https://www.nrc.gov/reactors/operating.html', verified_at=now(),
  provenance_note='Constellation Crane Clean Energy Center (TMI-1 restart), shut 2019. Microsoft 20-yr PPA (2024); NRC restart review. Capacity = pre-shutdown nameplate. Also present in decommissioning; counts here as capacity arriving back.'
WHERE project_name='Three Mile Island 1 Restart';

UPDATE new_reactor_projects SET source='DOE-ARDP / NRC', source_url='https://www.energy.gov/ne/advanced-reactor-demonstration-program', verified_at=now(),
  provenance_note='TerraPower Natrium, Kemmerer WY. DOE ARDP demonstration award 2020; non-nuclear construction started 2024. 345 MWe nominal (500 MWe peak) per TerraPower.'
WHERE project_name='Natrium';

UPDATE new_reactor_projects SET source='DOE-ARDP / NRC', source_url='https://www.energy.gov/ne/advanced-reactor-demonstration-program', verified_at=now(),
  provenance_note='X-energy Xe-100 at Dow, Seadrift TX. 4 x 80 MW. DOE ARDP award 2020; NRC pre-application review. Speculative confidence.'
WHERE project_name='Xe-100 / Dow Chemical';

UPDATE new_reactor_projects SET source='NRC-preapplication / TVA', source_url='https://www.nrc.gov/reactors/new-reactors.html', verified_at=now(),
  provenance_note='GE-Hitachi BWRX-300 at TVA Clinch River. Early site work; NRC pre-application engagement. Speculative confidence — not yet under construction.'
WHERE project_name='BWRX-300 (TVA Clinch River)';

UPDATE new_reactor_projects SET source='company-announcement', source_url='https://www.nrc.gov/reactors/new-reactors.html', verified_at=now(),
  provenance_note='Amazon/Dominion SMR PPA announced 2024; site and vendor TBD. Lowest-confidence row — capacity is a placeholder pending vendor selection. Excluded from headline pipeline (confidence=speculative).'
WHERE project_name='Amazon SMR (Dominion / Susquehanna)';
