"""
One-time backfill of daily_status_history from the NRC 365-day status file.

The same file the daily cron reads (PowerReactorStatusForLast365Days.txt) already
contains a full trailing year of daily power readings per unit. This script ingests
all of it so the history tape starts full instead of empty. Idempotent: upserts on
(reactor_id, report_date), so it is safe to re-run.

Run once:  python scripts/backfill_status_history.py
"""
import os
import time
from datetime import datetime, timezone
from supabase import create_client

from nrc_daily_status import (
    SUPABASE_URL, SUPABASE_SERVICE_KEY,
    fetch_nrc_data, parse_report_date, split_unit_field, match_plant, parse_power,
)

CHUNK = 500


def resolve_targets(unit_field, db_reactors, plant_names):
    """Map an NRC 'Unit' field to the reactor row(s) it refers to."""
    nrc_name, nrc_unit = split_unit_field(unit_field)
    matched_name = match_plant(nrc_name, nrc_unit, plant_names)
    if not matched_name:
        return []
    candidates = [r for r in db_reactors if r["plant_name"] == matched_name]
    by_unit = [r for r in candidates if r["unit_number"] == nrc_unit]
    return by_unit if by_unit else candidates


def main():
    start = time.time()
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    reactors = supabase.table("reactors").select("id, plant_name, unit_number").execute().data
    plant_names = list({r["plant_name"] for r in reactors})

    print("Fetching NRC 365-day status file…")
    all_rows = fetch_nrc_data()
    print(f"  {len(all_rows)} raw rows")

    # Resolve each distinct Unit field once, then apply across every date.
    unit_fields = {r.get("Unit", "").strip() for r in all_rows if r.get("Unit", "").strip()}
    cache = {uf: resolve_targets(uf, reactors, plant_names) for uf in unit_fields}
    unmatched = sorted(uf for uf, t in cache.items() if not t)
    print(f"  {len(unit_fields)} distinct units, {len(unmatched)} unmatched")

    history, seen = [], set()
    for row in all_rows:
        targets = cache.get(row.get("Unit", "").strip())
        if not targets:
            continue
        d = parse_report_date(row.get("ReportDt", "").strip())
        if not d:
            continue
        power = row.get("Power", "").strip()
        status_str = f"{power}% power" if power.isdigit() else power
        ppct, diso = parse_power(power), d.isoformat()
        for t in targets:
            key = (t["id"], diso)
            if key in seen:          # avoid duplicate conflict targets in one upsert
                continue
            seen.add(key)
            history.append({
                "reactor_id":  t["id"],
                "report_date": diso,
                "power_pct":   ppct,
                "status_text": status_str,
            })

    print(f"Upserting {len(history)} history rows…")
    for i in range(0, len(history), CHUNK):
        supabase.table("daily_status_history").upsert(
            history[i:i + CHUNK], on_conflict="reactor_id,report_date"
        ).execute()
        print(f"  {min(i + CHUNK, len(history))}/{len(history)}")

    duration = int((time.time() - start) * 1000)
    supabase.table("sync_log").insert({
        "source":        "backfill_status_history",
        "status":        "success",
        "rows_inserted": len(history),
        "duration_ms":   duration,
        "notes":         f"Backfilled {len(history)} rows across ~365 days. Unmatched units: {len(unmatched)}.",
    }).execute()

    print(f"Done: {len(history)} history rows written.")


if __name__ == "__main__":
    main()
