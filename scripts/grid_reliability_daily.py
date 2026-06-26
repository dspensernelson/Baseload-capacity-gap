"""
Materialize daily grid reliability snapshots from generation_hourly.

Outputs:
  1) grid_reliability_daily: per-day, per-source variability/ramp metrics
  2) grid_firming_daily: per-day firming snapshot (overnight nuclear share, etc.)

This is autonomous and idempotent (upserts by snapshot_date keys).

Run:
  python scripts/grid_reliability_daily.py
"""

import os
import time
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

ET = ZoneInfo("America/New_York")
LOOKBACK_DAYS = 45
MAX_ROWS = 1000


def bucket(fueltype):
    ft = (fueltype or "").strip().upper()
    if ft == "NUC":
        return "nuclear"
    if ft == "COL":
        return "coal"
    if ft == "NG":
        return "gas"
    if ft == "WAT":
        return "hydro"
    if ft in ("WND", "WNB"):
        return "wind"
    if ft in ("SUN", "SNB"):
        return "solar"
    return "other"


def percentile(values, p):
    if not values:
        return None
    arr = sorted(values)
    if len(arr) == 1:
        return float(arr[0])
    k = (len(arr) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return float(arr[f])
    return float(arr[f] + (arr[c] - arr[f]) * (k - f))


def mean(values):
    return (sum(values) / len(values)) if values else None


def stdev_pop(values):
    if not values:
        return None
    mu = mean(values)
    return math.sqrt(sum((v - mu) ** 2 for v in values) / len(values))


def fetch_generation_rows(sb, since_iso):
    out = []
    start = 0
    while True:
        chunk = (
            sb.table("generation_hourly")
            .select("period_utc,fueltype,mwh")
            .gte("period_utc", since_iso)
            .order("period_utc")
            .range(start, start + MAX_ROWS - 1)
            .execute()
            .data
        )
        if not chunk:
            break
        out.extend(chunk)
        if len(chunk) < MAX_ROWS:
            break
        start += MAX_ROWS
    return out


def write_sync_log(sb, status, rows_inserted, start_t, errors, notes):
    try:
        sb.table("sync_log").insert({
            "source": "grid_reliability_daily",
            "status": status,
            "rows_inserted": rows_inserted,
            "duration_ms": int((time.time() - start_t) * 1000),
            "error_message": ("; ".join(errors))[:500] if errors else None,
            "notes": notes,
        }).execute()
    except Exception as e:
        print(f"(could not write sync_log row: {e})")


def main():
    start_t = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    errors = []

    since_dt = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    since_iso = since_dt.isoformat()

    try:
        rows = fetch_generation_rows(sb, since_iso)
    except Exception as e:
        errors.append(f"fetch_error: {type(e).__name__}: {e}")
        write_sync_log(sb, "error", 0, start_t, errors, "Failed loading generation_hourly")
        raise SystemExit(1)

    by_hour_source = {}
    by_hour_total = {}

    bad_rows = 0
    for r in rows:
        try:
            period = datetime.fromisoformat(str(r["period_utc"]).replace("Z", "+00:00"))
            et = period.astimezone(ET)
            day = et.date().isoformat()
            hour_key = et.replace(minute=0, second=0, microsecond=0)
            src = bucket(r.get("fueltype"))
            gw = float(r.get("mwh") or 0) / 1000.0

            hs_key = (day, hour_key, src)
            by_hour_source[hs_key] = by_hour_source.get(hs_key, 0.0) + gw

            ht_key = (day, hour_key)
            if ht_key not in by_hour_total:
                by_hour_total[ht_key] = {"nuclear": 0.0, "wind": 0.0, "solar": 0.0, "total": 0.0}
            by_hour_total[ht_key]["total"] += gw
            if src in ("nuclear", "wind", "solar"):
                by_hour_total[ht_key][src] += gw
        except Exception:
            bad_rows += 1

    if bad_rows:
        errors.append(f"skipped {bad_rows} malformed generation row(s)")

    day_source_series = {}
    for (day, hour_key, src), gw in by_hour_source.items():
        key = (day, src)
        if key not in day_source_series:
            day_source_series[key] = []
        day_source_series[key].append((hour_key, gw))

    reliability_records = []
    for (day, src), series in day_source_series.items():
        series.sort(key=lambda x: x[0])
        vals = [v for _, v in series]
        if len(vals) < 6:
            continue
        deltas = [abs(vals[i] - vals[i - 1]) for i in range(1, len(vals))]
        avg = mean(vals)
        sd = stdev_pop(vals)
        cv = (sd / avg * 100.0) if (avg and avg != 0 and sd is not None) else None

        reliability_records.append({
            "snapshot_date": day,
            "source_key": src,
            "avg_gw": round(avg, 4) if avg is not None else None,
            "p10_gw": round(percentile(vals, 0.10), 4) if vals else None,
            "p90_gw": round(percentile(vals, 0.90), 4) if vals else None,
            "cv_pct": round(cv, 3) if cv is not None else None,
            "ramp95_gw": round(percentile(deltas, 0.95), 4) if deltas else None,
            "hours_observed": len(vals),
        })

    day_hours = {}
    for (day, hour_key), v in by_hour_total.items():
        if day not in day_hours:
            day_hours[day] = []
        day_hours[day].append((hour_key, v))

    firming_records = []
    for day, hours in day_hours.items():
        hours.sort(key=lambda x: x[0])
        overnight_nuclear = []
        overnight_solar = []
        overnight_wind = []
        overnight_total = []
        midday_solar = []
        low_renew_nuke_share = []
        low_renew_count = 0

        observed = 0
        for hour_key, v in hours:
            total = v["total"]
            if total <= 0:
                continue
            observed += 1
            hr = hour_key.hour
            if 0 <= hr <= 5:
                overnight_nuclear.append(v["nuclear"])
                overnight_solar.append(v["solar"])
                overnight_wind.append(v["wind"])
                overnight_total.append(total)
            if 11 <= hr <= 15:
                midday_solar.append(v["solar"])

            renew_share = (v["wind"] + v["solar"]) / total
            if renew_share < 0.15:
                low_renew_count += 1
                low_renew_nuke_share.append(v["nuclear"] / total)

        if observed < 12:
            continue

        overnight_share = None
        if overnight_total and overnight_nuclear:
            overnight_share = 100.0 * (mean(overnight_nuclear) / mean(overnight_total))

        firming_records.append({
            "snapshot_date": day,
            "overnight_nuclear_gw": round(mean(overnight_nuclear), 4) if overnight_nuclear else None,
            "overnight_solar_gw": round(mean(overnight_solar), 4) if overnight_solar else None,
            "overnight_wind_gw": round(mean(overnight_wind), 4) if overnight_wind else None,
            "overnight_total_gw": round(mean(overnight_total), 4) if overnight_total else None,
            "midday_solar_gw": round(mean(midday_solar), 4) if midday_solar else None,
            "overnight_nuclear_share_pct": round(overnight_share, 4) if overnight_share is not None else None,
            "low_renewables_hours_pct": round(100.0 * low_renew_count / observed, 4),
            "nuclear_share_when_low_renewables_pct": round(100.0 * mean(low_renew_nuke_share), 4) if low_renew_nuke_share else None,
            "hours_observed": observed,
        })

    written = 0
    try:
        if reliability_records:
            sb.table("grid_reliability_daily").upsert(
                reliability_records,
                on_conflict="snapshot_date,source_key",
            ).execute()
            written += len(reliability_records)

        if firming_records:
            sb.table("grid_firming_daily").upsert(
                firming_records,
                on_conflict="snapshot_date",
            ).execute()
            written += len(firming_records)
    except Exception as e:
        errors.append(f"upsert_error: {type(e).__name__}: {e}")

    status = "error" if errors else "success"
    notes = (
        f"generation rows={len(rows)}; reliability rows={len(reliability_records)}; "
        f"firming rows={len(firming_records)}; since={since_dt.date().isoformat()}"
    )
    write_sync_log(sb, status, written, start_t, errors, notes)

    print(f"Done: wrote {written} reliability snapshot row(s)")
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
