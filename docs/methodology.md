# Methodology

How the Nuclear Pipeline Tracker computes its numbers, where the data comes
from, and what the known caveats are.

## Data sources

| Data | Source | Refresh |
|------|--------|---------|
| Operating reactor inventory (94 units: name, operator, location, capacity, COD) | EIA v2 API, operating generator capacity, `technology=Nuclear` | Seeded once; re-runnable via `scripts/seed_reactors.py` |
| License expiration dates | NRC license renewal status pages (initial + subsequent renewal, issued history) | Weekly cron (`scripts/nrc_license_actions.py`) |
| License renewal applications in review | Same NRC pages | Weekly cron |
| Daily power level per unit | NRC Power Reactor Status report | Daily cron (`scripts/nrc_daily_status.py`) |
| Shutdown / decommissioning units | NRC decommissioning pages | Manual seed |
| New build pipeline (SMR + large) | NRC new reactors pages + DOE ARDP | Manual, curated quarterly |

## The three headline numbers

**Operating today** — sum of `capacity_mw` over reactors with status
`operating`. Capacity is EIA nameplate, so this reads slightly higher than
NRC's net summer capacity figures (~97 GW); the relative story is unchanged.

**Retiring by 2035** — capacity whose current NRC operating license expires on
or before 2035-12-31. "Current" matters: when NRC issues a renewal, the cron
updates the unit's expiration and it drops out of this number automatically.
This is therefore a *licensing* cliff, not a prediction — units can retire
early (economics) or keep running (renewal applications in review are still
counted as retiring until actually granted).

**In the pipeline** — sum of new-build projects marked `confirmed` with target
online year ≤ 2035. "Confirmed" is an editorial judgment (signed orders,
active licensing, committed capital — not press releases).

## The gap chart

`gap_series` (SQL view) walks year by year from 2025 to 2045:

- **retiring_mw** — capacity whose license expires that year
- **adding_mw** — new-build capacity targeting that year (confirmed and
  speculative are distinguished in the chart fill)
- **net_capacity_mw** — running total starting from today's operating base

Assumption: units retire at license expiration and new builds arrive in their
target year. Both are simplifications in opposite directions: subsequent
renewals will rescue some retiring capacity (this has been the dominant trend —
NRC approved eight subsequent renewals in 2024–2026 alone), while new-build
target dates historically slip. The chart is a "current trajectory" picture,
not a forecast.

## License actions

The `license_actions` table is rebuilt monthly from NRC's published status
tables. Date semantics worth knowing: NRC's "date entering (subsequent) period
of extended operation" is the *old* expiration; the renewed license runs 20
years past it. The scraper computes the final expiration accordingly, and
treats a date more than 25 years after issuance as already-final (NRC's tables
mix both conventions).

Shutdown plants in NRC's issued-renewal history (Indian Point, Oyster Creek,
Palisades, …) are intentionally skipped — they are not in the operating
inventory. Palisades' restart is tracked as a one-off `restart_authorization`
row preserved across rebuilds.

## Known caveats

- EIA nameplate vs NRC net capacity (~5% systematic difference, noted above).
- Two NRC daily-status units don't match the EIA inventory and are skipped
  (logged in `sync_log` every run).
- `new_reactor_projects` is curated by hand; the pipeline number is only as
  good as its last quarterly review.
- Early economic retirements (pre-license-expiration) are not predicted; they
  enter the data only when announced and recorded in `decommissioning`.
