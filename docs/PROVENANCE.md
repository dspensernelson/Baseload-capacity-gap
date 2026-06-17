# PROVENANCE — the audit trail for every number

> The promise of this project is that **every number survives a hostile fact-check.**
> This document is how we make that literally true and keep it true automatically.
> Read it before adding or changing any data the site displays.

---

## The principle: no orphan numbers

Every figure a visitor can see is exactly one of two kinds:

1. **Atomic fact** — a single reactor's capacity, its license date, a project's MW.
   It must carry *where it came from* (source + URL), *as of when*, and *when we last
   re-verified it*.
2. **Derived number** — the three headlines, the gap curve, fleet CF, the replacement
   math. It must be a *documented formula over atomic facts + named constants*.

If a number is neither sourced nor derived-from-sourced, it is a defect. Both data
errors we have ever shipped — Diablo Canyon mislabeled as new build, Watts Bar's
missing license date — were orphan numbers that no automated check could see, because
the watchdog only validated freshness, never provenance. This system closes that gap.

---

## The five layers

| Layer | What it is | Where |
|---|---|---|
| 1. Per-row provenance | `source`, `source_url`, `source_date`, `verified_at`, `provenance_note` on every curated table | `reactors`, `new_reactor_projects`, `decommissioning`, `license_actions` |
| 2. Metric registry | One row per public number: definition, exact formula, primary source + URL | `metric_lineage` table |
| 3. Reconciliation job | Re-derives each headline from atomic rows, compares to the live view, logs it | `scripts/reconcile.py` → `reconciliation_log` |
| 4. Public surface | Renders the registry + last-reconciled date for anyone to inspect | `/sources` page + "source ↗" on each headline |
| 5. Guards | Make a provenance gap a hard failure | `scripts/health_check.py` (daily) + reconcile (weekly) |

---

## Layer 1 — per-row provenance

Every row in the four hand-curated tables carries:

- `source` — short code: `EIA-860M` · `NRC-PRU` · `NRC-renewal` · `NRC-decommissioning` · `DOE-ARDP` · `company-announcement` · `manual`
- `source_url` — a public URL a skeptic can open. **Only use URLs already vetted in `VERIFY.md`** — do not invent links.
- `source_date` — the as-of date of the source (optional; nice-to-have precision)
- `verified_at` — last time the row was confirmed against its primary source
- `provenance_note` — free text; **required for manual rows**, especially low-confidence ones

Completeness = `source` AND `source_url` AND `verified_at` are all set. This is enforced
(see Layer 5). Today: **229/229 curated rows complete.**

Scrapers stamp these automatically going forward; manual rows are stamped by the curator.
The exact backfill lives in [`supabase/provenance.sql`](../supabase/provenance.sql).

## Layer 2 — the metric registry (`metric_lineage`)

One row per number shown anywhere on the site (20 today, across 16 surfaces). Columns:
`label`, `definition` (plain English), `formula` (exact SQL/arithmetic), `source_object`
(the view/table it comes from), `primary_source` + `primary_source_url`, `constants`,
and the reconcile stamps (`last_value`, `last_reconciled_at`, `reconcile_status`).

It is the single machine-readable spine: the reconcile job reads it, and the public
`/sources` page renders it, so the documentation can never drift from the numbers.
Seed lives in [`supabase/metric_lineage.sql`](../supabase/metric_lineage.sql).

## Layer 3 — reconciliation (`scripts/reconcile.py`)

The recurring, logged version of the manual fact-check. Each run:

1. **Cross-checks every headline** — re-derives `operating_mw`, `retiring_by_2035`,
   `pipeline_mw` *independently in Python* by summing the atomic rows, and compares to
   what the live `headline_numbers` view publishes. A mismatch > 1 MW = **drift** (it
   means the view was silently re-defined or a row slipped its filter).
2. **Enforces the two invariants** — every operating reactor has a license date
   (Watts Bar); no renewal/SLR row in the pipeline (Diablo Canyon).
3. **Checks provenance completeness** = 100%, and warns on rows unverified > 180 days.
4. **Writes the audit trail** — one `reconciliation_log` row per check, stamps
   `metric_lineage`, writes a `sync_log` receipt.

It always exits 0; alerting is via a labeled GitHub issue, never a red run or an email.

Run it locally: `python scripts/reconcile.py` (needs `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).
Cron: `.github/workflows/reconcile.yml` — weekly (Mon 13:30 UTC) and after the monthly
license scraper (renewals move "retiring by 2035").

## Layer 4 — the public surface (`/sources`)

"How we know every number." Renders `metric_lineage` grouped by surface, each number with
its definition, formula, source link, status chip (`cross-checked` / `formula on file` /
`assumption`), and last-checked date — topped by a live "last reconciled" badge from
`reconciliation_log`. Linked from the footer and from a "source ↗" link under each headline
number (`/sources#<metric_key>`).

## Layer 5 — the guards

- **Daily watchdog** (`health_check.py`, check 7): fails if any curated row lacks
  source/URL/verified_at — catches a regression within a day.
- **Weekly reconcile**: the deeper semantic cross-check above.

Both turn a failure into a GitHub issue and auto-close it when healthy. Silence = healthy.

---

## How to add or change a number (the workflow)

1. **Add/curate the data with provenance.** Never insert a curated row without
   `source`, `source_url`, `verified_at`. For manual rows, write a `provenance_note`.
2. **If it introduces a number the visitor sees, register it** in `metric_lineage`
   (label, definition, exact formula, primary source + URL). It then appears on `/sources`
   automatically.
3. **Run `reconcile.py`.** Confirm it passes and the new row reconciles.
4. **Done.** The daily watchdog and weekly reconcile now cover it forever.

If you change a SQL view's formula, update the matching `metric_lineage.formula` in the
same commit — otherwise reconcile will (correctly) flag drift between the published number
and its documented derivation.

---

## Where the ground truth lives

- **`/sources`** — the public, human-readable audit trail (always current)
- **`metric_lineage`** — every number's definition, formula, source
- **`reconciliation_log`** — append-only receipt of every reconciliation, per metric
- **`sync_log`** — every job run (scrapers, watchdog, reconcile)
- **Primary sources** — NRC (list of power reactor units, renewal, decommissioning,
  daily status), EIA (860M, EIA-930, capacity-factor tables), DOE ARDP. The canonical
  URLs are in [`VERIFY.md`](../VERIFY.md).
