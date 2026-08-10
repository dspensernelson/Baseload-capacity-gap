# ADR-0016 — A cron's exit code means "the feed failed," not "something was imperfect"

**Status:** Accepted · **Era:** Post-V1, August 2026

## Context
Between July 10 and August 2, 2026 the price crons produced six red workflow runs. Every one
of them had done its job:

| Run | Rows written | The "error" |
|-----|--------------|-------------|
| NYISO #145 (Aug 2) | 22,245 | one malformed row skipped in a real-time CSV |
| ERCOT #281 (Jul 31) | 140, from 35/36 docs | one listed DocID returned ERCOT's XML `Error Downloading Content - NO Results` instead of a zip |
| ERCOT #273 (Jul 30) | 140, from 35/36 docs | same |
| CAISO #34 / #21 / #17 | 1,268 / 120 / 1,272 | runner-side DNS: `Failed to resolve 'oasis.caiso.com'` |

The cause was one shared line in all three scripts: a single `errors` list collected every
imperfection — skipped rows, one unavailable source file, a transient network blip — and the
script ended with `if errors: raise SystemExit(1)`. Severity was never modelled, so a run that
delivered a full window of data exited 1 anyway.

Two things made it worse. The retry ladders only caught HTTP 5xx (and, for CAISO, 429), so a
`NameResolutionError` never entered the backoff path the retries existed for. And the
individual error strings were only ever written to `sync_log` — the Actions log printed a bare
`with 1 error(s)`, so the red X couldn't even be diagnosed without opening the database.

Meanwhile the watchdog (`scripts/health_check.py`) monitored none of the three feeds. The net
effect was backwards: cosmetic hiccups alerted six times in three weeks, while a genuinely
dead price feed would have alerted zero times. Under the automation ratchet (ADR-0010) an
alert that has to be manually judged and dismissed is itself the recurring manual task.

## Decision
**A non-zero exit means the feed failed to deliver. Nothing else.**

Each price script now sorts outcomes into two lists:

- **Fatal** (exit 1, `sync_log.status = 'error'`) — the source index is unreachable
  (ERCOT's document listing), the Supabase upsert failed, *every* fetch failed, or fetches
  succeeded but produced no usable rows (a real signal that the upstream format changed).
- **Warning** (exit 0, `sync_log.status = 'partial'`) — skipped malformed rows, one source
  file or hub failing while others succeed, an empty publish window. Printed to the Actions
  log *and* appended to `sync_log.notes`, so a partial run is still fully diagnosable.

Supporting changes:
- Retry ladders now also catch `ConnectionError` and `Timeout`, so DNS and connection blips
  get the backoff that already existed for 5xx. CAISO retries 5xx as well as 429.
- Every warning and fatal is printed. The Actions log is now self-sufficient.
- **The watchdog owns sustained failure.** `health_check.py` checks each price feed's most
  recent run *that actually wrote rows*, with thresholds at roughly three missed cron cycles
  — ERCOT 12h (2h cron), NYISO 18h (6h cron), CAISO 36h (daily cron). One bad run can never
  open an issue; a feed that has genuinely stopped always does.

## Consequences
- The red X regains its meaning: if a price workflow is red, data is missing. That is the
  whole point — an alert channel only works while it stays quiet by default.
- `sync_log.status` gains a third value, `'partial'`. The column is free text with no CHECK
  constraint, and the watchdog's other per-source checks compare against `'success'`
  explicitly, so nothing downstream needed a migration. `latest_delivering()` in the watchdog
  deliberately accepts `partial` — a partial run that wrote rows is proof the feed is alive.
- Detection of a dead feed moves from "immediate but unreliable" to "within ~3 cron cycles and
  trustworthy." That trade is correct here: these are trailing-window feeds with idempotent
  upserts, so a missed cycle is re-fetched by the next run and costs nothing.
- The same two-list shape should be copied by any future ISO feed (SPP, MISO, a keyed PJM).
  The generalizable rule, extending ADR-0015's closing lesson: **never let one source's
  hiccup erase another source's success — and never let it fail the run either.**
