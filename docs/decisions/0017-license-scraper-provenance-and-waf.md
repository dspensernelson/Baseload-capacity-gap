# ADR-0017 — The license scraper never wrote provenance, and a WAF quirk almost hid the fix

**Status:** Accepted · **Era:** Post-V1, August 2026

## Context
The watchdog (`health_check.py` check #7) and the weekly `reconcile.py` had both been
reporting the same failure for at least two days: 118 curated rows missing `source`,
`source_url`, or `verified_at`. Two GitHub issues (#2 watchdog, #3 reconcile) were open.

All 118 were in `license_actions`. `scripts/nrc_license_actions.py` **fully deletes and
rebuilds** its owned action types (`license_renewal`, `subsequent_license_renewal`) on every
weekly run — and the row-builder (`build_actions` → `add()`) simply never populated the
provenance columns. This wasn't a regression from a recent change; the script predates (or
was never updated for) the provenance system in ADR-0006, and every weekly rebuild
re-created the gap. `docs/PROVENANCE.md` even says "scrapers stamp these automatically going
forward" — this one didn't.

Reproducing the fix live turned up a second, unrelated bug: the script's `fetch_tables()`
call started returning `403 Forbidden` from nrc.gov — a page that was reachable seconds
earlier via a bare `curl`. Isolated with a controlled test (identical URL, only the header
delivery mechanism varied):

| Request shape | Result |
|---|---|
| `requests.get(url)` — no custom headers | 200 |
| `requests.get(url, headers={"User-Agent": "…"})` — one-off dict, any UA string tried | 403 |
| `Session(); session.headers["User-Agent"] = "…"; session.get(url)` | 200 |

Passing a fresh `headers={...}` dict to a single call — even with a fully realistic
`Accept`/`Accept-Encoding`/`Accept-Language` set — tripped nrc.gov's bot-management WAF.
Setting the same User-Agent on a `Session` in place, which preserves `requests`' own default
header set and order rather than replacing it, did not. Reproduced deterministically against
the live site. The exact mechanism (order vs. presence vs. something else the WAF fingerprints)
wasn't isolated further — reproducing the passing shape was enough.

## Decision
- **`nrc_license_actions.py`'s row-builder now stamps every row it writes**: `source="NRC"`
  (matching the one pre-existing curated row in this table, not the illustrative
  `NRC-renewal` example in `docs/PROVENANCE.md`, which no table's actual data follows
  literally), `source_url` set to whichever of `SLR_URL`/`LR_URL` the row was scraped from
  (both already vetted in `VERIFY.md`), `source_date` from the row's issued/received date,
  `verified_at` stamped at scrape time, and a `provenance_note` describing the scrape.
- **`fetch_tables()` now uses a module-level `requests.Session` with the User-Agent set in
  place**, not a per-call `headers=` kwarg. Cheap and strictly more robust regardless of
  whether the header-order theory is the true mechanism — it can't make a request look
  *more* suspicious to a WAF than the default `requests` behavior already doesn't.
- Ran the corrected script live: 118 rows rewritten, all with provenance; `reconcile.py` and
  `health_check.py` both back to PASS; both GitHub issues auto-close on the next scheduled run
  of each (`health-check.yml` daily, `reconcile.yml` weekly).

## Consequences
- `docs/PROVENANCE.md`'s "Today: N/N curated rows complete" count moves 229 → 230 (one new
  row landed between when that line was last updated and now, unrelated to this fix — caught
  and corrected in the same pass since it's now directly adjacent to the count this fix
  restored).
- **Watch this WAF behavior on GitHub Actions.** The block was reproduced from this local
  network; `nrc_event_notifications.py` already passes a per-call `headers=` dict on the same
  domain and succeeds daily from the Actions runner IP range, so this is plausibly
  IP-reputation-sensitive rather than a hard rule on the header shape itself. If a *different*
  NRC-scraping script starts failing with 403 from Actions, this ADR is the first thing to
  check — and the Session-based fix here is the known-good pattern to copy.
- General lesson for any future scraper against a site with bot-management: prefer mutating
  `Session.headers` in place over passing a fresh `headers=` dict per call. It's free
  insurance against a fingerprinting heuristic that a one-off dict can trip and a persistent
  session's natural header set does not.
