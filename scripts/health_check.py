"""
Watchdog — verify the data pipeline actually worked.

Deterministic checks against sync_log and data freshness. Designed to be QUIET:
- Writes health_status.txt = pass | fail | inconclusive  and health_report.txt.
- The workflow opens a GitHub issue only on `fail` and closes it on `pass`.
- A transient connection problem is `inconclusive` (not a failure) so the
  watchdog never cries wolf over a network blip. The process always exits 0;
  alerting happens through the issue, never through a red workflow run.

Run:  python scripts/health_check.py
"""
import os
import sys
import time
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

try:
    from supabase.lib.client_options import ClientOptions
except Exception:
    ClientOptions = None

load_dotenv()
SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

NOW = datetime.now(timezone.utc)
errors, warnings = [], []


def parse_ts(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def hours_since(ts):
    return (NOW - ts).total_seconds() / 3600 if ts else None


def make_client():
    # Bounded timeout so a hung connection fails fast (seconds, not minutes).
    if ClientOptions:
        try:
            return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY,
                                  options=ClientOptions(postgrest_client_timeout=20))
        except TypeError:
            pass
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def with_retry(fn, attempts=3, base_delay=4):
    last = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 — transient network errors
            last = e
            if i < attempts - 1:
                time.sleep(base_delay * (i + 1))
    raise last


def write_status(status, report):
    with open("health_status.txt", "w", encoding="utf-8") as f:
        f.write(status)
    with open("health_report.txt", "w", encoding="utf-8") as f:
        f.write(report)


def run_checks(sb):
    # Window has to cover the slowest threshold below (36h) with room to spare;
    # the price crons alone write ~17 rows/day.
    logs = with_retry(lambda: sb.table("sync_log").select("*")
                      .order("run_at", desc=True).limit(300).execute()).data

    def latest(source):
        return next((r for r in logs if r["source"] == source), None)

    def latest_delivering(source):
        """Newest run that actually landed rows — the only proof a feed is alive."""
        return next((r for r in logs
                     if r["source"] == source
                     and r.get("status") != "error"
                     and (r.get("rows_inserted") or 0) > 0), None)

    # 1 — Daily power-status cron ran, succeeded, updated a sane number of units
    d = latest("nrc_daily_status")
    if not d:
        errors.append("No `nrc_daily_status` run has ever been logged.")
    else:
        age = hours_since(parse_ts(d.get("run_at")))
        if d.get("status") != "success":
            errors.append(f"Daily status last run errored: {d.get('error_message') or d.get('notes')}")
        if age is None or age > 30:
            errors.append(f"Daily status is stale — last successful run {age:.0f}h ago (threshold 30h)."
                          if age else "Daily status run_at unparseable.")
        ru = d.get("rows_updated") or 0
        if ru < 60:
            errors.append(f"Daily status updated only {ru} reactors (<60) — likely a parse/name-match break.")
        elif ru < 85:
            warnings.append(f"Daily status updated {ru} reactors (expected ~92).")

    # 2 — History tape is still growing
    h = with_retry(lambda: sb.table("daily_status_history").select("report_date")
                   .order("report_date", desc=True).limit(1).execute()).data
    if not h:
        errors.append("daily_status_history is empty.")
    else:
        latest_day = datetime.fromisoformat(h[0]["report_date"]).replace(tzinfo=timezone.utc)
        days_old = (NOW - latest_day).days
        if days_old > 3:
            errors.append(f"History tape is stale — latest report_date {h[0]['report_date']} ({days_old}d old).")

    # 3 — Weekly license scraper isn't overdue
    l = latest("nrc_license_actions")
    if not l:
        warnings.append("No `nrc_license_actions` run logged yet.")
    else:
        age = hours_since(parse_ts(l.get("run_at")))
        if l.get("status") != "success":
            errors.append(f"License scraper last run errored: {l.get('error_message') or l.get('notes')}")
        elif age is not None and age > 24 * 10:
            errors.append(f"License scraper overdue — last run {age / 24:.0f}d ago (threshold 10d).")

    # 3b — Daily news ingest keeps the news_items archive fresh. News is a value-add,
    # not core data integrity, so a short delay is a warning; only a clear multi-day
    # breakage escalates to an error (which opens an issue).
    ni = latest("news_ingest")
    if not ni:
        warnings.append("No `news_ingest` run logged yet.")
    else:
        age = hours_since(parse_ts(ni.get("run_at")))
        if ni.get("status") != "success":
            warnings.append(f"News ingest last run errored: {ni.get('error_message') or ni.get('notes')}")
        elif age is None:
            warnings.append("News ingest run_at unparseable.")
        elif age > 72:
            errors.append(f"News ingest broken — last successful run {age / 24:.0f}d ago (threshold 3d).")
        elif age > 36:
            warnings.append(f"News ingest is late — last run {age:.0f}h ago (daily cron, threshold 36h).")

    # 3c — Wholesale price feeds. Individual runs deliberately tolerate partial
    # source hiccups (ADR-0016), so the red X no longer reports them — this is the
    # only place a genuinely dead price feed surfaces. Thresholds are ~3 missed
    # cron cycles, so a single bad run never opens an issue.
    for src, label, max_age_h in (
        ("ercot_prices", "ERCOT hub LMP (2h cron)", 12),
        ("nyiso_prices", "NYISO zonal LBMP (6h cron)", 18),
        ("caiso_prices", "CAISO hub LMP (daily cron)", 36),
    ):
        delivering = latest_delivering(src)
        if not delivering:
            errors.append(f"{label}: no run has written a row in the retained sync_log window.")
        else:
            age = hours_since(parse_ts(delivering.get("run_at")))
            if age is None:
                warnings.append(f"{label}: run_at unparseable.")
            elif age > max_age_h:
                errors.append(f"{label} is stale — last run to write rows was {age:.0f}h ago "
                              f"(threshold {max_age_h}h).")
        last = latest(src)
        if last and last.get("status") == "error":
            warnings.append(f"{label}: most recent run failed — {last.get('error_message')}")

    # 3d — Newsletter. The send step is built to skip quietly (exit 0) while keys
    # or subscribers don't exist, which also means it can skip quietly forever.
    # The rule is state-derived: a skip is fine with nobody on the list, and a
    # failure the moment someone is. Queried per source — weekly rows fall out of
    # the 300-row window above within days.
    def latest_of(source):
        rows = with_retry(lambda: sb.table("sync_log").select("*").eq("source", source)
                          .order("run_at", desc=True).limit(1).execute()).data
        return rows[0] if rows else None

    gen = latest_of("generate_newsletter")
    if not gen:
        warnings.append("No `generate_newsletter` run logged yet.")
    else:
        age = hours_since(parse_ts(gen.get("run_at")))
        if gen.get("status") != "success":
            errors.append(f"Weekly digest generation errored: {gen.get('error_message') or gen.get('notes')}")
        elif age is not None and age > 24 * 10:
            errors.append(f"Weekly digest overdue — last generated {age / 24:.0f}d ago (threshold 10d).")

    subs = with_retry(lambda: sb.table("subscribers").select("id", count="exact")
                      .eq("status", "active").execute())
    active_subs = subs.count or 0
    snd = latest_of("send_newsletter")
    if active_subs > 0:
        if not snd:
            errors.append(f"{active_subs} active subscriber(s) but `send_newsletter` has never run.")
        elif snd.get("status") == "skipped" and "already sent" not in (snd.get("notes") or ""):
            errors.append(f"{active_subs} active subscriber(s) but the last digest was not emailed — {snd.get('notes')}")
        elif snd.get("status") == "error":
            errors.append(f"Newsletter send failed for every subscriber: {snd.get('error_message')}")
        elif snd.get("status") == "partial":
            warnings.append(f"Newsletter send was partial — {snd.get('notes')}: {snd.get('error_message')}")

    # 4 — Headline numbers are in a sane range (catches data/view corruption)
    hn = with_retry(lambda: sb.table("headline_numbers").select("*").single().execute()).data
    op = float(hn.get("operating_mw") or 0)
    if not (90000 <= op <= 115000):
        errors.append(f"Operating capacity out of range: {op:.0f} MW (expected 90,000–115,000).")

    # 5 — every operating reactor needs a license expiration date, or it silently
    # drops out of "retiring by 2035" (the Watts Bar bug, June 2026).
    nl = with_retry(lambda: sb.table("reactors").select("id", count="exact")
                    .in_("status", ["operating", "license_renewed"])
                    .is_("license_expiration_date", "null").execute())
    if (nl.count or 0) > 0:
        errors.append(f"{nl.count} operating reactor(s) missing a license expiration date — they vanish from 'retiring by 2035'.")

    # 6 — the pipeline table is capacity ARRIVING only; a renewal/SLR row means an
    # existing operating plant got mislabeled as new build (the Diablo Canyon bug).
    projs = with_retry(lambda: sb.table("new_reactor_projects").select("project_name").execute()).data
    bad = [p["project_name"] for p in (projs or [])
           if any(k in (p.get("project_name") or "").lower() for k in ("slr", "renewal", "license renew"))]
    if bad:
        errors.append(f"new_reactor_projects has renewal/SLR rows (not new build): {', '.join(bad)}")

    # 7 — provenance completeness: every curated row must cite a source (the audit
    # trail). A sourceless row is a published number nobody can trace — the class of
    # gap the Diablo Canyon and Watts Bar errors fell through. The weekly reconcile
    # job checks this too; mirroring it here makes the daily watchdog catch it fast.
    prov_missing = 0
    for tbl in ("reactors", "new_reactor_projects", "decommissioning", "license_actions"):
        m = with_retry(lambda t=tbl: sb.table(t).select("id", count="exact")
                       .or_("source.is.null,source_url.is.null,verified_at.is.null").execute())
        prov_missing += (m.count or 0)
    if prov_missing > 0:
        errors.append(f"{prov_missing} curated row(s) missing source/URL/verified_at — "
                      f"a published number with no provenance.")

    return sb


def main():
    try:
        sb = make_client()
        run_checks(sb)
    except Exception as e:  # noqa: BLE001 — unreachable DB / transient: stay quiet
        msg = f"INCONCLUSIVE — watchdog could not complete checks (likely a transient connection issue): {type(e).__name__}: {str(e)[:200]}"
        print(msg)
        write_status("inconclusive", msg)
        return

    healthy = not errors
    lines = ["PASS — pipeline healthy" if healthy else "FAIL — pipeline needs attention"]
    for e in errors:
        lines.append(f"  ❌ {e}")
    for w in warnings:
        lines.append(f"  ⚠️  {w}")
    report = "\n".join(lines)
    print(report)

    try:
        with_retry(lambda: sb.table("sync_log").insert({
            "source": "health_check",
            "status": "success" if healthy else "error",
            "error_message": ("; ".join(errors))[:500] if errors else None,
            "notes": ("; ".join(warnings))[:500] if warnings else "all checks passed",
        }).execute(), attempts=2)
    except Exception as e:  # noqa: BLE001
        print(f"(could not write sync_log row: {e})")

    write_status("pass" if healthy else "fail", report)


if __name__ == "__main__":
    main()
    sys.exit(0)  # never fail the job; alerting is via the GitHub issue
