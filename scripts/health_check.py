"""
Watchdog — verify the data pipeline actually worked.

Deterministic checks (no LLM, runs free in Actions) against sync_log and data
freshness. Exits non-zero when something is broken; the workflow then opens a
GitHub issue. This is the layer that makes "fully automated" honest: a silent
cron failure surfaces within a day instead of rotting for a month.

Run:  python scripts/health_check.py
"""
import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

NOW = datetime.now(timezone.utc)

errors, warnings = [], []


def parse_ts(s):
    if not s:
        return None
    s = s.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def hours_since(ts):
    return (NOW - ts).total_seconds() / 3600 if ts else None


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    logs = sb.table("sync_log").select("*").order("run_at", desc=True).limit(60).execute().data

    def latest(source):
        return next((r for r in logs if r["source"] == source), None)

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
    h = (sb.table("daily_status_history").select("report_date")
         .order("report_date", desc=True).limit(1).execute().data)
    if not h:
        errors.append("daily_status_history is empty.")
    else:
        latest_day = datetime.fromisoformat(h[0]["report_date"]).replace(tzinfo=timezone.utc)
        days_old = (NOW - latest_day).days
        if days_old > 3:
            errors.append(f"History tape is stale — latest report_date {h[0]['report_date']} ({days_old}d old).")

    # 3 — Monthly license scraper isn't overdue
    l = latest("nrc_license_actions")
    if not l:
        warnings.append("No `nrc_license_actions` run logged yet.")
    else:
        age = hours_since(parse_ts(l.get("run_at")))
        if l.get("status") != "success":
            errors.append(f"License scraper last run errored: {l.get('error_message') or l.get('notes')}")
        elif age is not None and age > 24 * 40:
            errors.append(f"License scraper overdue — last run {age / 24:.0f}d ago (threshold 40d).")

    # 4 — Headline numbers are in a sane range (catches data/view corruption)
    try:
        hn = sb.table("headline_numbers").select("*").single().execute().data
        op = float(hn.get("operating_mw") or 0)
        if not (90000 <= op <= 115000):
            errors.append(f"Operating capacity out of range: {op:.0f} MW (expected 90,000–115,000).")
    except Exception as e:
        errors.append(f"headline_numbers unreadable: {e}")

    # ---- Report + record to sync_log ----
    healthy = not errors
    lines = ["PASS — pipeline healthy" if healthy else "FAIL — pipeline needs attention"]
    for e in errors:
        lines.append(f"  ❌ {e}")
    for w in warnings:
        lines.append(f"  ⚠️  {w}")
    report = "\n".join(lines)
    print(report)

    sb.table("sync_log").insert({
        "source": "health_check",
        "status": "success" if healthy else "error",
        "error_message": ("; ".join(errors))[:500] if errors else None,
        "notes": ("; ".join(warnings))[:500] if warnings else "all checks passed",
    }).execute()

    with open("health_report.txt", "w", encoding="utf-8") as f:
        f.write(report)

    sys.exit(0 if healthy else 1)


if __name__ == "__main__":
    main()
