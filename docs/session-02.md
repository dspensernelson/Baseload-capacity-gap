# Session 2 — Full Schema & Seed the Rest

**Time estimate:** 2–3 hours  
**Goal:** All 5 tables exist; SMR pipeline and decommissioning data seeded by hand.  
**End state:** Complete database ready to power the SQL views in Session 3.

---

## Step 2.1 — Build the Remaining 4 Tables

Open the Supabase SQL editor and run the DDL from `docs/data-model.md` for:
- `new_reactor_projects`
- `decommissioning`
- `license_actions`
- `sync_log`

Confirm all 5 tables appear in the Table Editor.

---

## Step 2.2 — Seed the SMR / New-Build Pipeline

There are only ~15–20 relevant projects. Manual entry is correct here — the data moves quarterly, not daily. Pull current stage from:
- **NRC new reactors:** nrc.gov/reactors/new-reactors.html
- **DOE ARDP:** energy.gov/ne/advanced-reactor-demonstration-program

Minimum projects to include:

| Project | Developer | Type | State | Est. Capacity | Target Year | Stage | Confidence |
|---------|-----------|------|-------|---------------|-------------|-------|------------|
| Vogtle 3 & 4 | Georgia Power | AP1000 | GA | ~1,117 each | online/2024 | under_construction | confirmed |
| Carbon Free Power Project | NuScale/UAMPS | NuScale SMR | ID | ~77 (6 modules) | cancelled | — | — |
| Xe-100 | X-energy | Xe-100 | WA | ~80 | ~2030 | nrc_review | speculative |
| BWRX-300 (TVA) | GE-Hitachi | BWRX-300 | TN | ~300 | ~2032 | early_stage | speculative |
| Kairos FHR | Kairos Power | FHR | TN | ~140 | ~2030 | nrc_review | speculative |
| Natrium | TerraPower | SFR | WY | ~345 | ~2030 | under_construction | confirmed |
| Palisades restart | Holtec | PWR | MI | ~811 | ~2025–2027 | licensed | confirmed |

Research current status of each before entering — things change. Add any others you find with DOE ARDP funding or active NRC review.

**Claude Code prompt for SQL insert help:**
```
Based on the schema in docs/data-model.md for new_reactor_projects,
write INSERT statements for the following projects: [paste your list].
Show me the SQL before I run it.
```

---

## Step 2.3 — Seed Decommissioning Records

From the NRC decommissioning page (nrc.gov/reactors/decommissioning), add recently shut units.

Key ones to include:

| Plant | Unit | Shutdown Date | Capacity MW Lost | Notes |
|-------|------|---------------|-----------------|-------|
| Palisades | 1 | 2022-05-20 | 811 | Restart bid — set restart_possible = true |
| Indian Point | 2 | 2020-04-30 | 1028 | |
| Indian Point | 3 | 2021-04-30 | 1041 | |
| Pilgrim | 1 | 2019-05-31 | 688 | |
| Three Mile Island | 1 | 2019-09-20 | 837 | Restart announced 2023 — set restart_possible = true |
| Diablo Canyon | 1 | deferred | 1118 | License extended to 2029+ |
| Diablo Canyon | 2 | deferred | 1122 | License extended to 2025+ |

After inserting decommissioning rows, update the matching `reactors` rows:

```sql
-- Example: update Palisades
UPDATE reactors 
SET status = 'shutdown' 
WHERE plant_name ILIKE '%palisades%';
```

Do this for each shutdown/decommissioning plant.

---

## Step 2.4 — Patch Null Coordinates

Run this query to find reactors with missing coordinates:

```sql
SELECT plant_name, unit_number, state 
FROM reactors 
WHERE latitude IS NULL OR longitude IS NULL
ORDER BY state;
```

For each missing plant, look up coordinates on Wikipedia (the plant's article always has lat/lng in the infobox). Update:

```sql
UPDATE reactors 
SET latitude = X.XX, longitude = -XX.XX 
WHERE plant_name ILIKE '%plant name%';
```

This takes ~10 minutes. Don't skip it — null coordinates won't render on the map.

---

## Step 2.5 — Verify

Run these queries in the SQL editor to confirm data completeness:

```sql
-- All 5 tables should have rows
SELECT 'reactors' as t, count(*) FROM reactors
UNION ALL SELECT 'new_reactor_projects', count(*) FROM new_reactor_projects
UNION ALL SELECT 'decommissioning', count(*) FROM decommissioning
UNION ALL SELECT 'sync_log', count(*) FROM sync_log;

-- Status distribution
SELECT status, count(*) FROM reactors GROUP BY status;

-- No null coordinates
SELECT count(*) FROM reactors WHERE latitude IS NULL OR longitude IS NULL;
```

---

## Session 2 Complete When

- [ ] All 5 tables exist and have data
- [ ] SMR/new-build pipeline has at least 10 projects entered
- [ ] Key decommissioning records are in (Palisades, Indian Point, TMI at minimum)
- [ ] Shutdown reactors have correct `status` values in `reactors` table
- [ ] Zero null coordinates in `reactors`
