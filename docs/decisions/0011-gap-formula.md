# ADR-0011 — The gap formula & nameplate vs. net

**Status:** Accepted · **Era:** V1, refined June 2026

## Context
The headline numbers are the argument, so their definitions must be fixed, defensible, and
documented — not quietly adjustable. Two specific choices needed pinning down: the retirement
cutoff logic, and which "capacity" we mean.

## Decision
- **Retiring by 2035** = `SUM(capacity_mw)` for units `status IN ('operating','license_renewed')`
  with `license_expiration_date <= 2035-12-31`. Every approved renewal pushes a unit out of
  this set, so the number *falls* as the NRC acts.
- **Pipeline** = confirmed `new_reactor_projects` arriving `<= 2035` (see [0008](0008-pipeline-arriving-only.md)).
- **Capacity = EIA nameplate** (~102 GW). US nuclear is also quoted ~97 GW (net-summer); both
  are correct, different definitions. The ~5% difference is documented on `/sources`, not a bug.
- The on-chart **"X GW gap by 2035"** label = gross retiring (the upper bound of what's at
  risk), deliberately *not* netted against the pipeline.

## Consequences
- Reproducible and auditable; the reconcile job re-derives each from atomic rows.
- Every operating reactor *must* carry a license date or it silently drops out — a watchdog
  guard exists for exactly this (the Watts Bar lesson).
- All four definitions are registered in `metric_lineage` and rendered on `/sources`.
