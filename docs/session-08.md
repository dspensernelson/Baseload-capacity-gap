# Session 8 — Deploy & The Live Cron

**Time estimate:** 2–3 hours  
**Goal:** Public URL live, one daily cron making the data feel alive.  
**End state:** You are at Point B. Share the link.

---

## Step 8.1 — Deploy the Frontend

### Option A: Vercel (recommended)

1. Push all code to GitHub (confirm no `.env` file is committed)
2. Go to vercel.com → New Project → Import from GitHub
3. Select `baseload-capacity-gap` repo
4. Framework preset: Vite (auto-detected)
5. Add environment variables in the Vercel dashboard:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
6. Deploy

Vercel auto-deploys on every push to `main`.

### Option B: Netlify

Same flow — connect repo, set env vars in Site Settings → Environment Variables, deploy.

### Custom Domain (if Student Pack approved)

1. In Vercel: Project Settings → Domains → Add
2. In Namecheap: point DNS to Vercel's nameservers
3. Vercel handles SSL automatically

If Student Pack isn't approved yet, the free `*.vercel.app` URL is fine for v1.

---

## Step 8.2 — Confirm the Live Site

After deployment:
- [ ] Open the public URL — site loads
- [ ] Reactor pins appear on the map (Supabase connection works)
- [ ] Headline numbers show correct values
- [ ] Gap chart renders
- [ ] Table is filterable
- [ ] No console errors about missing env vars or CORS

**CORS issue?** In Supabase: Project Settings → API → CORS allowed origins — add your Vercel domain.

---

## Step 8.3 — The NRC Daily Status Cron

This is the one thing that changes day-to-day. The NRC publishes a daily power reactor status report.

**NRC status file URL:**
```
https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/powerreactorstatusforlast365days.txt
```

This is a tab-delimited text file. Columns include: Date, Plant Name, Unit, Power (%), RX Type, NRC Region.

### Option A: GitHub Actions (easiest)

Create `.github/workflows/nrc-daily.yml`:

**Claude Code prompt:**
```
Create .github/workflows/nrc-daily.yml that:
1. Runs on schedule: cron '0 8 * * *' (8am UTC daily)
2. Runs on ubuntu-latest
3. Uses Python
4. Steps:
   a. Checkout repo
   b. Install python-dotenv and supabase-py
   c. Run scripts/nrc_daily_status.py

Create scripts/nrc_daily_status.py that:
1. Fetches https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/powerreactorstatusforlast365days.txt
2. Parses the tab-delimited file
3. Gets today's rows only (most recent date in the file)
4. For each row, finds the matching reactor in Supabase by plant_name (fuzzy match — NRC names differ from EIA names)
5. Updates reactors.daily_status and daily_status_updated_at
6. Writes one row to sync_log: source='nrc_daily_status', rows_updated=N, status='success' or 'error'
7. Exits 0 on success, 1 on error

GitHub Actions secrets needed: SUPABASE_URL, SUPABASE_SERVICE_KEY
(set these in repo Settings → Secrets and variables → Actions)

Show me the code first.
```

### Option B: Supabase Edge Function

If you prefer to keep everything in Supabase:

```bash
npx supabase functions new nrc-daily-status
```

Then deploy and schedule via the Supabase dashboard (Database → Extensions → pg_cron, or Functions → Schedule).

---

## Step 8.4 — Name Matching (NRC ↔ EIA)

NRC and EIA use different plant names (e.g., NRC says "VOGTLE" vs EIA "Vogtle"). You'll need a name mapping. 

**Claude Code prompt:**
```
In the nrc_daily_status script, after fetching the NRC data, 
build a name normalization function that:
1. Lowercases both sides
2. Strips common suffixes: 'nuclear power plant', 'nuclear power station', 'nuclear generating station'
3. Strips non-alphanumeric characters
4. Uses fuzzy matching (difflib.get_close_matches) as a fallback

Log any plant names that don't match so you can manually add them to a lookup table.
```

Expect ~10 manual mappings to add after the first run.

---

## Step 8.5 — Surface Daily Status on the Map

Update the detail panel in `Hook.jsx` to show `daily_status` when present:

```jsx
{reactor.daily_status && (
  <div style={{ 
    marginTop: '0.5rem', 
    fontSize: '0.85rem',
    color: reactor.daily_status.includes('0%') ? '#e76f51' : '#2d6a4f'
  }}>
    ● {reactor.daily_status}
    <span style={{ color: '#999', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
      (as of {new Date(reactor.daily_status_updated_at).toLocaleDateString()})
    </span>
  </div>
)}
```

---

## Step 8.6 — Verify the Cron

After deploying the GitHub Action:
1. Manually trigger it: Actions tab → nrc-daily-status → Run workflow
2. Check the run logs — confirm it completes without error
3. Check Supabase `sync_log` table — confirm one new row was inserted
4. Check `reactors.daily_status` for a few plants — confirm values were updated

---

## Session 8 Complete When

- [ ] Public URL is live and functional
- [ ] All three screens work in production (not just local)
- [ ] NRC daily cron deployed and manually tested
- [ ] `sync_log` has at least one successful cron run
- [ ] `daily_status` visible on map detail panel for at least some plants
- [ ] URL is shareable — send it to someone

---

## You're at Point B

> A public URL where a curious person sees three numbers, a US map of reactors colored by status, a gap chart through ~2045, and a filterable table — all backed by real EIA + NRC data, with a live daily cron making it feel alive.

Update `CLAUDE.md` → Current Session to reflect this. Then park the V2 ideas and rest.
