# ADR-0006 — Provenance & reconciliation

**Status:** Accepted · **Era:** June 2026

## Context
Two data errors shipped and survived the watchdog: Diablo Canyon's license renewal was
mislabeled as new build (inflating the pipeline), and Watts Bar units had null license dates
(silently dropping out of "retiring by 2035"). The watchdog only checked *freshness*, never
the *semantic correctness* of hand-curated data. For a site whose entire promise is "every
number survives a hostile fact-check," that gap was existential.

## Decision
Build a provenance system, in four layers:
1. **Per-row provenance** — `source`/`source_url`/`verified_at`/… on every curated table.
2. **`metric_lineage`** — every public number registered with its definition, *exact formula*,
   and primary source + URL.
3. **`reconcile.py`** (weekly cron) — re-derives each headline *independently in Python* from
   atomic rows, compares to the live view, logs to `reconciliation_log`, flags drift.
4. **`/sources`** — the public page that renders all of it, with a live "last reconciled" badge.

Plus watchdog guards for the two specific error classes (no operating reactor without a
license date; no renewal/SLR row in the pipeline).

## Consequences
- "Survives a hostile fact-check" becomes literally true *and visible* — the differentiator.
- A view edited to a different formula is caught (Python re-derivation ≠ view value → drift).
- The discipline generalized to the docs themselves ([docs_check.py](../../scripts/docs_check.py)).
- See [PROVENANCE.md](../PROVENANCE.md) for the full charter.
