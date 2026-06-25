# ADR-0013 — Regulatory Radar: snapshot-diff, and the license cron moves to weekly

**Status:** Accepted · **Era:** Post-V1, June 2026

## Context
VISION's Surface 3 calls for a weekly plain-English digest of NRC license/docket movement
("Hatch's 80-year extension moved to final review..."). Two problems stood in the way:

1. `nrc_license_actions.py` **fully rebuilds** `license_actions` on every run (delete +
   reinsert of the owned action types) to stay simple and source-of-truth-driven. That
   means the table has no row-level history — there's no `created_at`/`updated_at` you can
   query to ask "what changed since last week."
2. The license cron only ran **monthly**, so a "weekly" digest sourced from it would report
   "nothing changed" three weeks out of four — not wrong, just not the feature anyone meant.

## Decision
- **License cron moves to weekly** (`nrc-license-weekly.yml`, Mondays 09:00 UTC, renamed
  from `nrc-license-monthly.yml`). This is a real, independently-justified improvement, not
  a workaround: VISION's own north-star metric is "time-from-NRC-action-to-site-update stays
  under 24 hours," and monthly was already short of that.
- **`scripts/generate_radar.py`** runs immediately after, in the same job. Since the table
  has no history, it snapshots the current `(reactor_id, action_type) -> status` state into
  `reports.stats.snapshot` (`kind='weekly_radar'`) and diffs it against *last week's* stored
  snapshot to find new under-review filings and under_review→approved transitions. No
  diff on the first run (no previous snapshot) — it writes a baseline count instead.
- Reuses the existing `reports` table (`unique(kind, period)` already supports a second
  `kind`) rather than a new table — `period` is the ISO week (`'YYYY-Www'`).
- Rendered **alongside**, not instead of, the existing always-live pending/issued list in
  `Dispatches.jsx` — the live list answers "what's true right now," the digest answers
  "what changed." Different questions, same section.
- The watchdog's overdue threshold for the license scraper tightened from 40 days to 10
  (`scripts/health_check.py`), matching the new cadence.

## Consequences
- The snapshot-diff technique is reusable for any other table that gets rebuilt wholesale
  instead of updated in place — worth reaching for again before adding row-level
  history-tracking columns to a source-of-truth-rebuilt table.
- `reconcile.yml` and `health-check.yml` both key off the license workflow's exact `name:`
  via `workflow_run` — renaming it required updating both in the same change, or the
  watchdog/reconciliation silently stop hearing about license-cron runs.
- A quiet week is reported as "No NRC license-action changes recorded this week," not
  hidden — consistent with showing the honest picture even when it's uneventful.
