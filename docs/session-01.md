# Session 1 — Seed the Database

**Time estimate:** 2–3 hours  
**Goal:** Real EIA reactor data living in Supabase. One script, run once.  
**End state:** ~94 reactor rows in Supabase, spot-checked and confirmed.

---

## Prerequisites Check

Before writing a line of code, confirm:
- [ ] EIA API key is in `.env` as `EIA_API_KEY`
- [ ] Supabase project exists and keys are in `.env`
- [ ] GitHub repo is cloned locally
- [ ] `.env` is in `.gitignore`

---

## Step 1.1 — Create the `reactors` Table

Open the Supabase SQL editor and run the DDL from `docs/data-model.md` for the `reactors` table only. You'll add the other four tables in Session 2.

After running, confirm the table appears in the Table Editor with the correct columns.

---

## Step 1.2 — Understand the EIA Endpoint

The EIA v2 API pattern before writing a single line:

**Base URL:** `https://api.eia.gov/v2/`

**Endpoint for nuclear generators:**
```
GET /v2/electricity/operating-generator-capacity
  ?api_key=YOUR_KEY
  &facets[technology][]=Nuclear
  &data[]=nameplate-capacity-mw
  &data[]=operating-year
  &data[]=latitude
  &data[]=longitude
  &data[]=entityName
  &data[]=stateid
  &length=100
  &offset=0
```

**Response shape:**
```json
{
  "response": {
    "total": 94,
    "dateFormat": "...",
    "data": [
      {
        "plantid": "3413",
        "generatorid": "1",
        "plantName": "Vogtle",
        "entityName": "Georgia Power Co",
        "stateid": "GA",
        "latitude": 33.14,
        "longitude": -81.76,
        "nameplate-capacity-mw": 1117,
        "operating-year": "1987",
        "technology": "Nuclear"
      },
      ...
    ]
  }
}
```

Nuclear subset is small (~94 units) so one page covers it, but write the pagination loop anyway — it's a reusable skill.

---

## Step 1.3 — Write the Seed Script

**Claude Code prompt:**
```
Read CLAUDE.md and docs/session-01.md.

Write a Python script at scripts/seed_reactors.py that:
1. Loads EIA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY from .env using python-dotenv
2. Calls the EIA v2 /electricity/operating-generator-capacity endpoint
   with facets[technology][]=Nuclear
3. Paginates with length=100 and offset until response.data is empty
4. For each row, maps fields to the reactors table as described in docs/data-model.md
5. Sets status = 'operating' for every row
6. Upserts into Supabase keyed on (eia_plant_id, unit_number)
7. Prints "Done: X rows upserted" at the end

Use supabase-py for the database client.
Show me the code — don't create the file yet.
```

Read the generated code line by line. Confirm:
- Field mapping matches `docs/data-model.md`
- Upsert conflict target is `(eia_plant_id, unit_number)` 
- Status is hardcoded to `'operating'`
- Pagination loop looks correct

When satisfied, ask Claude Code to create the file.

---

## Step 1.4 — Install Dependencies and Run

```bash
pip install python-dotenv supabase requests
python scripts/seed_reactors.py
```

Expected output: `Done: 94 rows upserted` (give or take a few based on current EIA data)

---

## Step 1.5 — Verify the Data

Open Supabase → Table Editor → `reactors`.

Spot-check these three plants — they're large, well-known, and geographically spread:

| Plant | State | Expected capacity_mw (per unit) | Expected lat range |
|-------|-------|--------------------------------|--------------------|
| Vogtle | GA | ~1,100–1,117 | 33.1x |
| Diablo Canyon | CA | ~1,118–1,122 | 35.2x |
| Palo Verde | AZ | ~1,270–1,314 | 33.3x |

Also confirm:
- No rows have `null` lat/lng that look suspicious (a few nulls are expected — patch in Session 2)
- All rows have `status = 'operating'`
- `capacity_mw` is in the hundreds-to-~1,250 range (not thousands — that would be a units bug)

---

## Session 1 Complete When

- [ ] `reactors` table has ~94 rows
- [ ] Vogtle, Diablo Canyon, Palo Verde look correct
- [ ] Script runs cleanly a second time without duplicating rows (upsert works)
- [ ] No credentials are committed to git (`git status` shows `.env` as untracked)

---

## Common Issues

**`401 Unauthorized` from EIA:** API key not loaded from `.env`. Check the env var name matches exactly.

**`0 rows upserted`:** The facet filter syntax may have changed. Test the URL directly in your browser with your API key to see the raw response.

**Duplicate rows on second run:** Upsert conflict target is wrong. The `ON CONFLICT` clause must reference the unique constraint on `(eia_plant_id, unit_number)`.

**`null` coordinates:** Normal for some plants — EIA doesn't have coords for everything. You'll patch these in Session 2 using Wikipedia.
