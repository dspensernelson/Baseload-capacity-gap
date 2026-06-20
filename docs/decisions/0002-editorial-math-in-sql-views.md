# ADR-0002 — Editorial math lives in SQL views

**Status:** Accepted · **Era:** V1

## Context
The headline numbers and the gap curve are the argument. If that math is scattered across
React components, it can diverge between views, can't be audited in one place, and can't be
re-checked independently. Numbers are the product; they must be reproducible.

## Decision
**All aggregation lives in Postgres views** (`headline_numbers`, `gap_series`,
`fleet_output_series`, `reactor_cf_90d`). React components consume views and render — they
never `reduce()` a headline number themselves.

## Consequences
- One auditable place for every editorial number.
- Changing a number means changing a view — and updating its `metric_lineage` row in the
  same commit (see [0006](0006-provenance-system.md)).
- The reconciliation job can re-derive the same number a *second* way (in Python) and prove
  the view still matches.
- React stays "dumb," which keeps the frontend simple and the math testable.
