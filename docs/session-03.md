# Session 3 — The Gap View

**Time estimate:** 1–2 hours  
**Goal:** Postgres views that compute the three headline numbers and the year-by-year gap series.  
**End state:** Both views return correct data in the SQL editor. This is the editorial core of the product.

---

## Why This Session Matters

All the editorial math — the three headline numbers, the chart data — lives in SQL, not in React. This is a deliberate architectural choice. If the numbers are wrong later, you fix them in one place (the view) and every screen updates automatically.

---

## Step 3.1 — Create the `headline_numbers` View

Copy the view DDL from `docs/data-model.md` and run it in the Supabase SQL editor.

Then query it:
```sql
SELECT * FROM headline_numbers;
```

Expected result: three columns, one row.
- `operating_mw` ≈ 97,000 (97 GW total US nuclear capacity)
- `retiring_by_2035_mw` — some subset of operating capacity
- `confirmed_pipeline_mw` — your entered new-build capacity

**If `operating_mw` is way off:**
- If it's ~97 (not ~97,000): you have a GW vs MW bug in the seed data. Check `capacity_mw` values in `reactors` — they should be hundreds to ~1,300, not fractions.
- If it's 0: check `status` filter — all operating rows should have `status = 'operating'`

---

## Step 3.2 — Create the `gap_series` View

Copy the view DDL from `docs/data-model.md` and run it.

```sql
SELECT * FROM gap_series ORDER BY year;
```

Expected shape: 21 rows (2025–2045), columns: `year`, `retiring_mw`, `adding_mw`, `net_capacity_mw`.

**Sanity checks:**
- 2025 `net_capacity_mw` should be close to `operating_mw` from `headline_numbers`
- Years with no retirements or additions show `0` for those columns (not null)
- `net_capacity_mw` trends generally downward (that's the thesis)
- Any year with a confirmed new build shows a positive `adding_mw`

---

## Step 3.3 — Tune the Views for Your Data

After verifying the raw output, you may need to adjust based on what you actually entered:

**If `license_expiration_date` is null for many reactors:**
Many operating reactors have 20-year license renewals in flight. Supplement with `decommissioning.shutdown_date` for already-shut units. Ask Claude Code to adjust the retirement query to use `COALESCE(license_expiration_date, shutdown_date)` if needed.

**If `target_online_year` is missing for some pipeline projects:**
Update those rows in `new_reactor_projects` before this view will count them.

---

## Step 3.4 — Save the DDL

Copy both completed view DDL statements into `supabase/schema.sql` so everything needed to recreate the database is in one place.

**Claude Code prompt:**
```
Create supabase/schema.sql containing:
1. The reactors table DDL
2. The new_reactor_projects table DDL
3. The decommissioning table DDL
4. The license_actions table DDL
5. The sync_log table DDL
6. The headline_numbers view DDL
7. The gap_series view DDL

Use the schemas from docs/data-model.md. Add comments separating each section.
```

---

## Session 3 Complete When

- [ ] `headline_numbers` view returns a single row with `operating_mw` ≈ 97,000
- [ ] `gap_series` view returns 21 rows (2025–2045) with sensible values
- [ ] Both views saved to `supabase/schema.sql`
- [ ] Numbers make editorial sense (the gap is visible in the data)
