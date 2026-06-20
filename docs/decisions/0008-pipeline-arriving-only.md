# ADR-0008 — Pipeline = capacity arriving only

**Status:** Accepted · **Era:** June 2026

## Context
Diablo Canyon's subsequent license renewal (an *operating* plant getting 20 more years) was
added to `new_reactor_projects` and counted in the pipeline number — double-counting capacity
already in the operating fleet and inflating "in the pipeline" from 2.0 GW to 4.2 GW. The user
caught it on the map ("this isn't a new build").

## Decision
`new_reactor_projects` holds **only capacity *arriving***: new builds and restarts of
shut-down units (Palisades, TMI-1). **Never** existing operating plants being renewed — those
already live in `reactors` + `license_actions`. Renewals reduce the *retiring* number; they
never add to the *pipeline* number.

## Consequences
- The pipeline figure is honest (no double-count of the operating fleet).
- A watchdog guard rejects any `new_reactor_projects` row whose name contains "SLR / renewal /
  license renew."
- One of the two errors that motivated the whole provenance system ([0006](0006-provenance-system.md)).
- Restarts legitimately appear in *both* `decommissioning` (the shutdown) and
  `new_reactor_projects` (the arrival) — intentional, and noted on each row's provenance.
