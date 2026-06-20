# SOURCES — the system of record

Every external source this project draws from, what it feeds, and how. The per-*number*
provenance is on the live [`/sources`](https://nukemap-two.vercel.app/sources) page and in
`metric_lineage`; this file is the per-*source* catalog. **NRC and EIA are the ground truth.**

| Source | URL | Feeds | Via | Cadence |
|---|---|---|---|---|
| **NRC Power Reactor Status Report** | nrc.gov/reading-rm/doc-collections/event-status/reactor-status/ | daily power % per unit | `nrc_daily_status.py` | daily 08:00 UTC |
| **NRC List of Power Reactor Units** | nrc.gov/reactors/operating/list-power-reactor-units.html | operating count, license expirations | reference + license cron | — |
| **NRC license-renewal pages** | nrc.gov/reactors/operating/licensing/renewal/applications.html | `license_actions`, `reactors.license_expiration_date` | `nrc_license_actions.py` | monthly, 1st |
| **NRC Event Notification Reports** | nrc.gov/reading-rm/doc-collections/event-status/event/ | `incidents` (the live wire) | `nrc_event_notifications.py` | daily 09:00 UTC |
| **NRC Decommissioning info-finder** | nrc.gov/info-finder/decommissioning/power-reactor/ | `decommissioning` | manual seed | quarterly |
| **NRC New Reactors** | nrc.gov/reactors/new-reactors.html | `new_reactor_projects` | manual curation | quarterly |
| **EIA-860M (operating-generator-capacity)** | eia.gov/electricity/data/eia860m/ · EIA v2 API | reactor inventory, capacity, location | `seed_reactors.py` | seed (→ annual) |
| **EIA-930 Hourly Electric Grid Monitor** | eia.gov/electricity/gridmonitor/ | `generation_hourly` (2 a.m. view) | `eia930_generation.py` | every 6 h |
| **DOE ARDP** | energy.gov/ne/advanced-reactor-demonstration-program | pipeline credibility | manual curation | quarterly |
| **Our World in Data — safest sources** | ourworldindata.org/safest-sources-of-energy | `energy_safety`, `notable_accidents` (deaths/TWh) | manual seed | rare |
| **IPCC AR5 (lifecycle emissions)** | ipcc.ch/report/ar5/wg3/ | `energy_safety.ghg_co2e_per_kwh` | manual seed | rare |
| **UNSCEAR / Government of Japan** | unscear.org | `notable_accidents` (Chernobyl/Fukushima tolls) | manual seed | rare |
| **World Nuclear Association** | world-nuclear.org/.../outline-history-of-nuclear-energy | `history_milestones` | manual seed | rare |

## Notes on honesty
- **Two capacity definitions.** "Operating today" uses EIA **nameplate** (~102 GW); you'll
  also see US nuclear quoted ~97 GW (net-summer). Both correct — noted on `/sources`.
- **Contested tolls.** Chernobyl's long-term toll is debated (we show a range); Fukushima's
  larger figure is evacuation-related, not radiation. Sourced to UNSCEAR / Japan gov.
- **The NRC event wire includes non-reactor notices** (materials, medical, agreement-state).
  `incidents` filters to rows with a `Facility` (i.e. plant events) — see
  [decisions/0007-incidents-facility-filter.md](decisions/0007-incidents-facility-filter.md).
- **NRC reorganizes URLs occasionally.** If a link 404s, search "NRC [topic]"; the watchdog
  + reconcile will flag a broken scrape, and the source-watch agent (roadmap) will repair it.

## When NRC/EIA changes a format
The scrapers are written against documented layouts and are deliberately defensive (they log
a raw sample to `sync_log` when a parse yields too few rows). The watchdog detects the break;
the fix is a one-line parser change. See `scripts/nrc_event_notifications.py` for the pattern.
