# VERIFY — Expected Behavior & Data Fact-Check

> A living checklist. We move fast, so re-run the **5-minute pass** after any notable change or
> roughly weekly. When a number looks off, jump to **Fact-check the data** and confirm it against the
> primary source. When a page misbehaves, check **Per-page expected behavior**.
>
> Companion docs: [TESTING.md](TESTING.md) is the click-through UI walkthrough; this doc is the
> "is everything correct and behaving" reference, including external sources of truth.
>
> Live site: **https://baseload-capacity-gap.vercel.app** · Repo: **github.com/dspensernelson/NukeMap**
> Last verified: `____________`  By: `____________`

---

## 1. The 5-minute health pass (run this regularly)

- [ ] Site loads at the live URL; no blank screen, no "Loading…" stuck forever.
- [ ] **Header pulse** reads something like `~90–100% of the fleet · ~90–100 GW online now · ~90/94 units running`. (Lower in spring/fall refueling season is normal; **0% or 0/94 is a red flag**.)
- [ ] **Footer** "last update" date is **today or yesterday**. (Older than ~2 days = the daily cron is stuck.)
- [ ] **Overview** numbers: Operating ≈ **101.9 GW**, Retiring by 2035 ≈ **13 GW**, Pipeline ≈ **2.0 GW**.
- [ ] **Map** shows the lower-48 with green dots; a few may be hollow rings (refueling). Not all-gray, not empty.
- [ ] Click one reactor → panel opens with data + a sparkline.
- [ ] No open **⚠️ Watchdog** issue in GitHub → the pipeline is healthy (see §3).
- [ ] **`/sources`** shows a green "Last reconciled ⟨recent date⟩ — every headline traced back to its source" badge. (Amber/“under review” = the reconcile job found drift; see §3.)
- [ ] No red runs in the GitHub **Actions** tab in the last day.

If all of the above pass, the system is working. The sections below are for when something looks off, or for a deeper periodic audit.

---

## 2. Automated safety nets (what you do NOT have to check by hand)

These run on their own and will tell you if something breaks, so **silence = healthy**:

- **Watchdog** (`Pipeline Health Watchdog` workflow) runs after every data cron + daily at 13:00 UTC. It checks freshness + sanity and **opens a GitHub issue only when something is genuinely wrong**, then **auto-closes it** when healthy. So: *no watchdog issue = data is fresh and sane.* It will not email you for transient blips.
- **Reconciliation** (`Numbers Reconciliation` workflow) runs weekly + after the license cron. It re-derives every headline number *independently* from the atomic reactor rows and compares to what the live views publish, checks 100% provenance completeness, and re-enforces the Watts Bar + Diablo Canyon invariants. Opens a `reconcile`-labeled issue **only on drift**; the public `/sources` page shows the last-reconciled date and every number's formula + source. Receipts in the `reconciliation_log` table.
- **`sync_log` table** (Supabase) records every cron run — source, status, rows, timestamp, notes. This is the audit trail; check it when you want proof a job ran.
- **Crons**: daily power (08:00 UTC), weekly license + Regulatory Radar (Mon 09:00 UTC), monthly dispatch (2nd). All free, all logged.

What is **still manual** (intentionally): the SMR / new-build pipeline (`new_reactor_projects`) is editor-curated. That's the one dataset worth a human eye each quarter (see §4, Pipeline row).

---

## 3. Per-page expected behavior

### Global (every page)
- **Header**: title links to `/`; nav = Overview · The Fleet · Dispatches (active tab underlined); live **pulse** on the right with a pulsing green dot.
- **Footer**: data-freshness line with the last-update date; "updates on their own" note.
- **Deep links**: typing `/fleet`, `/dispatches`, or a reactor URL directly (or refreshing on them) loads that page — does **not** 404.

### Overview (`/`)
- Full-bleed green **gap chart** with the amber wedge growing from the bottom-right and a "≈13 GW gap by 2035" marker.
- Three headline numbers flush below (amber middle number).
- An **"Explore the map →"** button linking to the Map tab. (No map on this page — it's the lean thesis landing.)

### Map (`/map`)
- **ISO/RTO filter pills** → clicking one filters **both** the map and the table; count updates; "All" resets.
- **Map**: continental US, soft ISO region shading with one label each, dots colored by status, **hollow rings = offline/refueling**, legend bottom-left. Click a dot → detail panel (status, live MW, license history, 90-day sparkline, "Full reactor page →"). Click empty area → panel closes.
- **Table**: 6 columns, **sticky header**, click a header to sort, plant names are **links** to reactor pages.

### The Fleet (`/fleet`)
- "Right now" stat band: % of capacity online, GW generating, units running, units offline for refueling.
- **12-month output chart**: a line hovering near **~92 GW** under a dashed **~100 GW capacity** reference line, with visible dips for refueling season. Hover → date, GW, capacity-factor %, units offline.

### The Grid (`/grid`)
- **The 2 a.m. test**: a 48-hour stacked grid-mix chart (nuclear flat at the base; solar swings to zero each night) + an overnight callout comparing nuclear vs solar. Live-ish from EIA-930 (refreshes every 6h). Confirm against the EIA grid monitor (see §4).
- **Replacement math**: pick a reactor → the GW of wind or solar (plus turbines / land) needed to match its annual energy, using EIA capacity factors (nuclear 93%, wind 35%, solar 24%). Energy-only, clearly caveated. Changing the dropdown recomputes everything.

### Scenarios (`/scenarios`)
- Three sliders (future renewals, pipeline delay, pipeline build-out) that **recompute the gap chart live**. Default (0% future renewals) ≈ today's committed reality; dragging renewals up closes the gap (history says nearly all reactors renew). Labeled a model, not a forecast.

### Dispatches (`/dispatches`)
- The latest auto-generated monthly **Dispatch** (dated, "auto-generated"), with three sections (fleet / license front / pipeline) and real numbers matching the headline figures.
- Archive rail appears once more than one month exists.

### Reactor page (`/reactor/:slug`)
- Plant name + unit, status badge, live power line (`100% power · ~1,310 MW now`, or "Offline" if refueling).
- Facts: operator, state, capacity, commercial-operation year, license expiration, ISO/RTO.
- License history lines (✓ approved / ⏳ under review), and a 90-day power sparkline.
- A bad/old link shows a clean "Reactor not found" with a back link.

---

## 4. Fact-check the data against primary sources

Spot-check a couple of these on each deeper audit. **NRC and EIA are the ground truth.** (NRC occasionally reorganizes URLs — if a link 404s, search "NRC [topic]".)

| On the site | Should be… | Confirm at |
|---|---|---|
| **Operating count & capacity** (~94 units, 101.9 GW) | ~94 operating units | NRC **List of Power Reactor Units** — nrc.gov/reactors/operating/list-power-reactor-units.html |
| **A reactor's daily power %** | matches today's NRC report | NRC **Power Reactor Status Report** — nrc.gov/reading-rm/doc-collections/event-status/reactor-status/ |
| **A unit's license expiration** | matches NRC | same NRC list-of-power-reactor-units page (has expiration dates) |
| **License renewals / 80-yr (SLR) approvals** | matches NRC | NRC renewal — nrc.gov/reactors/operating/licensing/renewal/subsequent-license-renewal.html and …/applications.html |
| **Retiring by 2035** (~13 GW) | sum of capacity for operating units whose license expires ≤ 2035 and have **not** been renewed (every operating unit must have a license date, or it's wrongly excluded) | derive from the NRC list; every approved renewal should *reduce* this number |
| **Pipeline** (~2.0 GW) ← MANUAL | capacity *arriving* — new SMRs + restarts of shut-down units (Palisades, TMI-1). **Not** existing plants getting renewed (those belong in the operating fleet) | NRC **New Reactors** nrc.gov/reactors/new-reactors.html · DOE **ARDP** energy.gov/ne/advanced-reactor-demonstration-program |
| **Decommissioning / shutdown units** | matches NRC | NRC **Decommissioning** — nrc.gov/info-finder/decommissioning/power-reactor/ |
| **Fleet ~92% capacity factor / output** | US nuclear runs ~92–93% CF | EIA **Hourly Electric Grid Monitor** eia.gov/electricity/gridmonitor/ · EIA "Nuclear explained" |

**Known, expected discrepancy:** our "Operating today" uses EIA **nameplate** capacity (~101.9 GW); you'll also see US nuclear quoted around **~97 GW** (net summer capacity). Both are correct — different definitions. This is noted on **The Sources** (`/sources`, the nameplate-vs-net entry); don't treat the ~5% gap as a bug.

---

## 5. Red flags & what to do

| Symptom | Likely cause | Action |
|---|---|---|
| Footer date > 2 days old | daily cron stopped | Check Actions tab → re-run `NRC Daily Reactor Status`; the watchdog should already have filed an issue |
| Pulse shows 0% / 0 GW / 0 units | daily parse broke (NRC format/URL change) | Check latest `nrc_daily_status` row in `sync_log` notes; inspect the NRC file |
| Operating ≠ ~100 GW (e.g., 0 or 300) | data or SQL-view problem | Check `headline_numbers` view + `reactors` table |
| Map empty / all dots gray | reactors didn't load, or a frontend error | Open browser console; check the Supabase `reactors` fetch |
| A **⚠️ Watchdog** issue is open | something genuinely stale/wrong | Read the issue body — it lists exactly what failed |
| A number contradicts NRC | stale scrape or a real NRC change | Re-run the relevant cron; if NRC changed a page, the scraper may need a fix |
| Dispatch numbers ≠ headline numbers | dispatch generated from older data | Harmless if recent; re-run `Monthly Dispatch` to refresh |

---

## 6. Where the ground truth lives (our system)

- **Live site** — https://baseload-capacity-gap.vercel.app (auto-deploys from `main`)
- **Supabase** — tables: `reactors`, `new_reactor_projects`, `decommissioning`, `license_actions`, `sync_log`, `daily_status_history`, `reports`; views: `headline_numbers`, `gap_series`, `fleet_output_series`
- **GitHub Actions** — cron runs + the watchdog (red run or open issue = look here)
- **`sync_log`** — every job's receipt (what ran, when, how many rows, errors)
- **The Sources** (`/sources`) — the public methodology: how each number is defined, computed & sourced, plus the weekly reconciliation. Internal notes: `docs/methodology.md` · `docs/PROVENANCE.md`. (`/methodology.html` now redirects here.)
