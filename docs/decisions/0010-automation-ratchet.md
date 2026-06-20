# ADR-0010 — The automation ratchet

**Status:** Accepted · **Era:** V1 → ongoing

## Context
The destination is an institution with no staff (see `docs/VISION.md`, internal). Anything a
human does by hand on a schedule will eventually not get done — and every manual step is a
place the data goes stale or wrong.

## Decision
**Any recurring manual task is treated as a defect; the fix is a cron or an agent.** Manual
effort is reserved for *editorial judgment* that genuinely needs taste (which SMR projects are
credible). When a human touches the same task twice, the third time is automated.

## Consequences
- Seven crons now run the data plane with no human in the path; the watchdog and reconcile
  jobs verify them; `sync_log` records every run.
- Target metrics that must never regress: **time-from-source-to-site < 24 h**, and **human
  operational hours → 0**.
- The durable investment is the *watchdog → agent-fix loop*: over years, NRC/EIA will change
  formats; detection exists, and the auto-repair (an agent reads the break and opens a fix PR)
  is the next rung.
