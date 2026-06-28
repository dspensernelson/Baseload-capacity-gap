# Baseload — The Capacity Gap — Master Checklist

Track your progress from empty repo to live V1. Check items off as you go.

---

## Prerequisites (Before Session 1)

- [ ] Register for EIA API key at eia.gov/opendata/register — free, arrives by email
- [ ] Create Supabase project named `nuclear-pipeline` — save DB password, URL, anon key, service key
- [ ] Create GitHub repo named `baseload-capacity-gap` (private to start)
- [ ] Clone repo locally
- [ ] Apply for GitHub Student Pack at education.github.com/pack with DePaul email (takes ~1 day)
- [ ] Create `.env` file in repo root with `EIA_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- [ ] Add `.env` to `.gitignore` immediately

---

## Session 1 — Seed the Database

**Goal: real EIA reactor data living in Supabase**

- [ ] Create `scripts/` folder in repo
- [ ] Create Python project (or Node) in `scripts/`
- [ ] Create `reactors` table in Supabase SQL editor (see `docs/data-model.md`)
- [ ] Understand EIA v2 endpoint structure before writing code
- [ ] Write `scripts/seed_reactors.py` that:
  - [ ] Loads env vars from `.env`
  - [ ] Paginates EIA API until no rows remain
  - [ ] Maps EIA fields → `reactors` columns
  - [ ] Sets `status = 'operating'` for all rows
  - [ ] Upserts keyed on `eia_plant_id + unit_number`
  - [ ] Prints row count on completion
- [ ] Run `python scripts/seed_reactors.py`
- [ ] Verify ~94 rows in Supabase Table Editor
- [ ] Spot-check Vogtle (GA), Diablo Canyon (CA), Palo Verde (AZ)
  - [ ] lat/lng look like real US coordinates
  - [ ] `capacity_mw` is in the hundreds–1,250 range per unit

---

## Session 2 — Full Schema & Seed the Rest

**Goal: all 5 tables exist; SMR pipeline and decommissioning data seeded**

- [ ] Create remaining 4 tables in Supabase SQL editor:
  - [ ] `new_reactor_projects`
  - [ ] `decommissioning`
  - [ ] `license_actions`
  - [ ] `sync_log`
- [ ] Manually seed SMR / new-build pipeline (~15–20 projects) from NRC new reactors page + DOE ARDP
- [ ] Manually seed decommissioning records from NRC decommissioning page
  - [ ] Palisades (note restart bid)
  - [ ] Indian Point
  - [ ] Diablo Canyon (deferred-retirement status)
  - [ ] Other recently shut units
- [ ] Update `reactors.status` to `'shutdown'` or `'decommissioning'` for shut units
- [ ] Patch any null coordinates using Wikipedia plant pages (~10 min)
- [ ] Verify all 5 tables have data

---

## Session 3 — The Gap View

**Goal: Postgres views powering the three headline numbers and year-by-year chart data**

- [ ] Write `headline_numbers` view returning:
  - [ ] Operating capacity today (MW)
  - [ ] Capacity retiring by 2035 (MW)
  - [ ] Pipeline capacity (MW)
- [ ] Write `gap_series` view returning one row per year (now → 2045):
  - [ ] `year`
  - [ ] `retiring_mw` (capacity retiring that year)
  - [ ] `adding_mw` (new capacity coming online that year)
  - [ ] `net_capacity_mw` (running total)
- [ ] Verify total operating capacity ≈ 97 GW (if wildly off, check MW vs GW unit bug)
- [ ] Sanity-check gap series in SQL editor before rendering anything
- [ ] Save view SQL to `supabase/schema.sql`

---

## Session 4 — Frontend Skeleton

**Goal: React app connected to Supabase, data visible in browser**

- [ ] Scaffold React app: `npm create vite@latest baseload-capacity-gap -- --template react`
- [ ] Install dependencies: `npm install @supabase/supabase-js`
- [ ] Create `src/supabase.js` with configured Supabase client (reads from env vars)
- [ ] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`
- [ ] Create test component that fetches `reactors` and dumps JSON to `<pre>` tag
- [ ] Confirm reactor JSON appears in browser ✓ (pipeline connected end-to-end)
- [ ] Fetch `headline_numbers` view — confirm data returns
- [ ] Fetch `gap_series` view — confirm data returns
- [ ] Stub three screen components: `<Hook />`, `<GapChart />`, `<ReactorTable />`
- [ ] Wire them into `App.jsx` as single scrolling page with max-width container
- [ ] Remove test `<pre>` component

---

## Session 5 — The Map (The Hook)

**Goal: US map with color-coded reactor pins and ISO/RTO overlays**

- [ ] Install MapLibre GL: `npm install maplibre-gl`
- [ ] Add free map style URL (CARTO or OpenFreeMap — no token needed)
- [ ] Center map on continental US, set min/max zoom
- [ ] Add reactor circle markers:
  - [ ] Color by status: operating=green, shutdown=gray, decommissioning=red/orange, pipeline=blue
  - [ ] Radius encodes `capacity_mw`
- [ ] Pin click → detail panel showing: name, operator, capacity, COD, license expiration, status, pending actions
- [ ] Download ISO/RTO boundary GeoJSON (PJM, MISO, ERCOT, CAISO, SPP, NYISO, ISO-NE, TVA/SERC)
- [ ] Add translucent ISO/RTO fill layer beneath pins
- [ ] ISO/RTO click → filter headline numbers and table to that region
- [ ] Test on a few known plants

---

## Session 6 — The Gap Chart

**Goal: one chart that makes the thesis undeniable**

- [ ] Install Recharts: `npm install recharts`
- [ ] Build chart consuming `gap_series` view (no aggregation in React)
- [ ] X axis: year (now → 2045)
- [ ] Area trending down: cumulative capacity lost to retirements
- [ ] Area trending up: cumulative new build coming online
- [ ] Gap between areas shaded in amber
- [ ] Label the gap directly on the chart (not in a legend)
- [ ] Annotate 2035 with a vertical reference line + headline number
- [ ] Distinguish confirmed vs speculative capacity (solid vs hatched/lighter fill)
- [x] Add "how we calculated this" link to a methodology note
- [x] Write `docs/methodology.md` explaining the data sources and assumptions

---

## Session 7 — Table & Visual Polish

**Goal: filterable reactor table, styled headline band, coherent visual identity**

- [ ] Build `<ReactorTable />` with columns: state, plant, unit, operator, capacity, COD, license expiration, status
- [ ] Add client-side filters: status, state, operator, license-expiration window
- [ ] Add sort by: capacity, age, expiration
- [ ] Build headline band (3 big numbers, always visible at top)
  - [ ] Style the middle number (capacity retiring) heavier than the others
- [ ] Establish visual identity:
  - [ ] Choose brand color
  - [ ] Amber reserved exclusively for gap
  - [ ] Display typeface for headline numbers
  - [ ] Clean body typeface
  - [ ] Generous whitespace
  - [ ] Visual hierarchy: Hook → Gap → Table
- [ ] Test all filters work correctly
- [ ] Review on desktop at 1280px and 1440px width

---

## Session 8 — Deploy & Live Cron

**Goal: public URL + one live daily cron**

- [x] Connect GitHub repo to Vercel (or Netlify)
- [x] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in host dashboard env vars
- [x] Confirm live site reads from Supabase
- [x] Point custom domain (if Student Pack approved) or use free `*.vercel.app` URL — https://baseload-capacity-gap.vercel.app
- [x] Write NRC daily status cron (Supabase Edge Function OR GitHub Action):
  - [x] Fetch NRC daily power reactor status text file
  - [x] Parse each unit's power %
  - [x] Update `reactors.daily_status`
  - [x] Write one row to `sync_log` (source, timestamp, rows updated, any error)
- [x] Deploy and verify cron runs successfully (92/94 units matched; Palisades + 2 others unmatched by design)
- [x] Surface `daily_status` on map detail panel ("100% power" / "offline")
- [x] Confirm `sync_log` has a row from the cron run
- [x] Share the public URL 🎉

---

## Post-V1 (Do Not Start Until V1 Is Live)

- [ ] EIA-930 live generation by balancing authority
- [ ] Wind/solar/storage context layer
- [ ] EIA-923 monthly generation refresh cron
- [x] NRC license-renewal scraper (weekly cron, June 2026 — uprate tracking still open)
- [x] Surface license actions in map detail panel
- [x] Regulatory Radar weekly digest (June 2026 — alongside the live pending/issued list)
- [x] Demand-growth band on the gap chart (June 2026 — EIA AEO2026 reference case, ADR-0014)
- [x] Wholesale pricing layer — CAISO pilot only (June 2026 — ADR-0015; ERCOT/PJM/real-time still open)
- [ ] ADAMS document feed
- [ ] Mobile layout + shareable deep links
- [ ] Paperclip agent org setup
