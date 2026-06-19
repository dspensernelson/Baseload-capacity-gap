-- The story of nuclear power as a sourced timeline (the History tab). Idempotent.
-- Sources: World Nuclear Association, U.S. DOE / NRC / EIA, UNSCEAR.
CREATE TABLE IF NOT EXISTS history_milestones (
  slug TEXT PRIMARY KEY, year INTEGER, year_label TEXT, title TEXT, description TEXT,
  category TEXT,          -- discovery | milestone | accident | expansion | retirement | revival
  sort_order INTEGER DEFAULT 0,
  source TEXT, source_url TEXT, source_date DATE, verified_at TIMESTAMPTZ, provenance_note TEXT
);
ALTER TABLE history_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "history_milestones public read" ON history_milestones;
CREATE POLICY "history_milestones public read" ON history_milestones FOR SELECT USING (true);

INSERT INTO history_milestones (slug,year,year_label,title,description,category,sort_order,source,source_url,verified_at) VALUES
('fission-1938',1938,'1938','Fission is discovered','Otto Hahn and Fritz Strassmann split the uranium atom in Berlin; Lise Meitner and Otto Frisch explain what happened. The atomic age begins on paper.','discovery',10,'World Nuclear Association','https://world-nuclear.org/information-library/current-and-future-generation/outline-history-of-nuclear-energy',now()),
('chicago-pile-1942',1942,'1942','The first chain reaction','Enrico Fermi''s team achieves the first controlled, self-sustaining nuclear chain reaction under the stands at the University of Chicago — Chicago Pile-1.','discovery',20,'U.S. DOE','https://www.energy.gov/ne/nuclear-energy',now()),
('ebr1-1951',1951,'1951','First electricity from the atom','Experimental Breeder Reactor I (EBR-I) in Idaho lights four bulbs — the first usable electricity ever generated from nuclear energy.','milestone',30,'U.S. DOE','https://www.energy.gov/ne/nuclear-energy',now()),
('obninsk-1954',1954,'1954','First reactor on a grid','The Obninsk plant near Moscow becomes the first nuclear reactor to deliver electricity to a power grid.','milestone',40,'World Nuclear Association','https://world-nuclear.org/information-library/current-and-future-generation/outline-history-of-nuclear-energy',now()),
('shippingport-1957',1957,'1957','America goes commercial','Shippingport, Pennsylvania, comes online as the first full-scale commercial nuclear plant in the U.S. The same year, the Windscale fire strikes the UK.','milestone',50,'U.S. NRC / DOE','https://www.energy.gov/ne/nuclear-energy',now()),
('buildout-1960s',1967,'1960s–70s','The great buildout','Dozens of reactors are ordered and built across the U.S. and the world. Nuclear becomes a mainstream source of electricity.','expansion',60,'World Nuclear Association','https://world-nuclear.org/information-library/current-and-future-generation/outline-history-of-nuclear-energy',now()),
('oil-crisis-1973',1973,'1973','The oil shock','The OPEC oil embargo sends energy prices soaring and U.S. reactor orders to their all-time peak.','expansion',70,'World Nuclear Association','https://world-nuclear.org/information-library/current-and-future-generation/outline-history-of-nuclear-energy',now()),
('tmi-1979',1979,'1979','Three Mile Island','A partial meltdown at TMI-2 in Pennsylvania — contained, with no detectable public-health effects, but it freezes public confidence and new U.S. orders collapse.','accident',80,'U.S. NRC','https://www.nrc.gov/reading-rm/doc-collections/fact-sheets/3mile-isle.html',now()),
('chernobyl-1986',1986,'1986','Chernobyl','A reactor explosion in Soviet Ukraine becomes the worst nuclear accident in history and reshapes global attitudes toward nuclear power for a generation.','accident',90,'UNSCEAR / IAEA','https://world-nuclear.org/information-library/current-and-future-generation/outline-history-of-nuclear-energy',now()),
('watts-bar-1-1996',1996,'1996','The buildout ends','Tennessee''s Watts Bar 1 connects to the grid — the last U.S. reactor to do so for twenty years.','milestone',100,'U.S. NRC','https://www.nrc.gov/reactors/operating/list-power-reactor-units.html',now()),
('plateau-2000s',2005,'2000s','Run harder, build nothing','U.S. reactors hit capacity factors above 90% — running harder than ever — but an announced "nuclear renaissance" produces almost no new plants.','expansion',110,'U.S. EIA','https://www.eia.gov/nuclear/',now()),
('fukushima-2011',2011,'2011','Fukushima','A tsunami knocks out cooling at Fukushima Daiichi in Japan. The larger toll comes from the evacuation, not radiation — and Germany and others begin phasing nuclear out.','accident',120,'Government of Japan / UNSCEAR','https://world-nuclear.org/information-library/current-and-future-generation/outline-history-of-nuclear-energy',now()),
('retirements-2013',2017,'2013–2021','The quiet retirements','A wave of U.S. reactors shut early on economics — Kewaunee, Vermont Yankee, Indian Point, Palisades and more — even as they run reliably. The gap this site tracks begins to open.','retirement',130,'U.S. EIA','https://www.eia.gov/nuclear/',now()),
('watts-bar-2-2016',2016,'2016','Watts Bar 2','Watts Bar 2 starts up — the first newly operational U.S. reactor in two decades.','milestone',140,'U.S. NRC','https://www.nrc.gov/reactors/operating/list-power-reactor-units.html',now()),
('policy-turns-2022',2022,'2022','Policy turns','The Inflation Reduction Act adds tax credits for nuclear; Diablo Canyon wins a reprieve. Palisades shuts — then becomes the first U.S. plant to file for a restart.','revival',150,'U.S. DOE','https://www.energy.gov/ne/nuclear-energy',now()),
('vogtle-2023',2023,'2023–24','Vogtle 3 & 4','Georgia''s Vogtle 3 and 4 (AP1000s) come online — the first newly built U.S. reactors in over thirty years, over budget and years behind schedule.','milestone',160,'U.S. NRC','https://www.nrc.gov/reactors/new-reactors.html',now()),
('restart-era-2024',2024,'2024','The restart era','Constellation moves to restart Three Mile Island Unit 1 under a Microsoft power deal; the NRC clears Palisades to reopen — the first-ever revivals of shut U.S. reactors.','revival',170,'U.S. NRC','https://www.nrc.gov/reactors/new-reactors.html',now()),
('the-gap-2025',2025,'2025 →','The gap, and the race','Demand from data centers surges while more capacity nears license expiry than is being built. Restarts and small modular reactors race to fill the gap — the story this site tracks in real time.','revival',180,'U.S. EIA / NRC','https://www.eia.gov/nuclear/',now())
ON CONFLICT (slug) DO UPDATE SET year=EXCLUDED.year, year_label=EXCLUDED.year_label, title=EXCLUDED.title,
 description=EXCLUDED.description, category=EXCLUDED.category, sort_order=EXCLUDED.sort_order,
 source=EXCLUDED.source, source_url=EXCLUDED.source_url, verified_at=EXCLUDED.verified_at;
