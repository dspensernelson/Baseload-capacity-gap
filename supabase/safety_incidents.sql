-- ============================================================
-- Safety + Incidents schema & reference seed
--   energy_safety / notable_accidents — cited reference data (The Sources)
--   incidents                         — scraper-fed NRC Event Notifications (no seed)
-- Idempotent. See docs/PROVENANCE.md. Reference figures: Our World in Data
-- (Markandya & Wilkinson 2007; Sovacool et al. 2016), UNSCEAR, IPCC AR5.
-- ============================================================

CREATE TABLE IF NOT EXISTS energy_safety (
  energy_source     TEXT PRIMARY KEY,
  category          TEXT,                    -- 'combustion' | 'clean'
  deaths_per_twh    NUMERIC,
  ghg_co2e_per_kwh  NUMERIC,
  note              TEXT,
  sort_order        INTEGER DEFAULT 0,
  source            TEXT, source_url TEXT, source_date DATE, verified_at TIMESTAMPTZ, provenance_note TEXT
);
ALTER TABLE energy_safety ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "energy_safety public read" ON energy_safety;
CREATE POLICY "energy_safety public read" ON energy_safety FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS notable_accidents (
  slug TEXT PRIMARY KEY, name TEXT, energy_source TEXT, year INTEGER, location TEXT,
  ines_level INTEGER, deaths_low INTEGER, deaths_high INTEGER, deaths_label TEXT, summary TEXT,
  sort_order INTEGER DEFAULT 0,
  source TEXT, source_url TEXT, source_date DATE, verified_at TIMESTAMPTZ, provenance_note TEXT
);
ALTER TABLE notable_accidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notable_accidents public read" ON notable_accidents;
CREATE POLICY "notable_accidents public read" ON notable_accidents FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS incidents (
  event_number TEXT PRIMARY KEY, event_date DATE, report_date DATE, facility TEXT, unit TEXT,
  state TEXT, region TEXT, rx_type TEXT, emergency_class TEXT, notification_basis TEXT, description TEXT,
  reactor_id UUID REFERENCES reactors(id),
  source TEXT, source_url TEXT, source_date DATE, verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incidents_event_date_idx ON incidents (event_date DESC);
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "incidents public read" ON incidents;
CREATE POLICY "incidents public read" ON incidents FOR SELECT USING (true);

-- ---- Seed: energy_safety (deaths/TWh = accidents + air pollution; GHG = IPCC AR5 median) ----
INSERT INTO energy_safety (energy_source,category,deaths_per_twh,ghg_co2e_per_kwh,note,sort_order,source,source_url,verified_at) VALUES
('Coal','combustion',24.6,820,'Almost all of these are chronic air-pollution deaths, not mine accidents.',10,'Our World in Data','https://ourworldindata.org/safest-sources-of-energy',now()),
('Oil','combustion',18.4,715,'Air pollution dominates, plus extraction and refining accidents.',20,'Our World in Data','https://ourworldindata.org/safest-sources-of-energy',now()),
('Biomass','combustion',4.6,230,'Renewable, but combustion still produces air pollution.',30,'Our World in Data','https://ourworldindata.org/safest-sources-of-energy',now()),
('Natural gas','combustion',2.8,490,'Cleaner-burning than coal, but still air pollution and extraction accidents.',40,'Our World in Data','https://ourworldindata.org/safest-sources-of-energy',now()),
('Hydropower','clean',1.3,24,'Low overall — but dominated by one event: Banqiao (1975).',50,'Our World in Data','https://ourworldindata.org/safest-sources-of-energy',now()),
('Wind','clean',0.04,11,'Mostly construction and maintenance accidents.',60,'Our World in Data','https://ourworldindata.org/safest-sources-of-energy',now()),
('Nuclear','clean',0.03,12,'Includes Chernobyl and Fukushima — and is still among the very safest.',70,'Our World in Data','https://ourworldindata.org/safest-sources-of-energy',now()),
('Solar','clean',0.02,48,'Rooftop-installation falls are the main risk.',80,'Our World in Data','https://ourworldindata.org/safest-sources-of-energy',now())
ON CONFLICT (energy_source) DO UPDATE SET category=EXCLUDED.category, deaths_per_twh=EXCLUDED.deaths_per_twh,
  ghg_co2e_per_kwh=EXCLUDED.ghg_co2e_per_kwh, note=EXCLUDED.note, sort_order=EXCLUDED.sort_order,
  source=EXCLUDED.source, source_url=EXCLUDED.source_url, verified_at=EXCLUDED.verified_at;

-- ---- Seed: notable_accidents (lead with the worst, honestly; Banqiao as counterweight) ----
INSERT INTO notable_accidents (slug,name,energy_source,year,location,ines_level,deaths_low,deaths_high,deaths_label,summary,sort_order,source,source_url,verified_at) VALUES
('three-mile-island','Three Mile Island','Nuclear',1979,'Pennsylvania, USA',5,0,NULL,'0 deaths','A partial core meltdown — but containment held. Decades of follow-up have found no detectable public-health effects.',10,'UNSCEAR / U.S. NRC','https://www.nrc.gov/reading-rm/doc-collections/fact-sheets/3mile-isle.html',now()),
('chernobyl','Chernobyl','Nuclear',1986,'Pripyat, Ukraine (USSR)',7,31,433,'~31 direct; ~433 modeled total (long-term estimates range higher)','The worst nuclear accident in history. ~31 acute deaths; projected long-term cancer deaths are debated.',20,'UNSCEAR (2008) / OWID','https://ourworldindata.org/safest-sources-of-energy',now()),
('fukushima','Fukushima Daiichi','Nuclear',2011,'Fukushima, Japan',7,1,2314,'1 radiation death; ~2,314 from the evacuation — not radiation','Triggered by a tsunami. One death attributed to radiation; the larger toll came from the evacuation.',30,'Government of Japan / UNSCEAR','https://ourworldindata.org/safest-sources-of-energy',now()),
('banqiao','Banqiao Dam failure','Hydropower',1975,'Henan, China',NULL,26000,240000,'~171,000 (estimates 26,000-240,000)','A dam failure after a typhoon — the deadliest energy accident in history, and why hydropower''s rate exceeds nuclear''s.',40,'Our World in Data','https://ourworldindata.org/safest-sources-of-energy',now())
ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, energy_source=EXCLUDED.energy_source, year=EXCLUDED.year,
  location=EXCLUDED.location, ines_level=EXCLUDED.ines_level, deaths_low=EXCLUDED.deaths_low, deaths_high=EXCLUDED.deaths_high,
  deaths_label=EXCLUDED.deaths_label, summary=EXCLUDED.summary, sort_order=EXCLUDED.sort_order,
  source=EXCLUDED.source, source_url=EXCLUDED.source_url, verified_at=EXCLUDED.verified_at;
