"""
Ingest NYISO zonal LBMP pricing (day-ahead and real-time) from public MIS CSV feeds
into wholesale_prices with no API key.

Sources (public, no key):
  http://mis.nyiso.com/public/csv/damlbmp/YYYYMMDDdamlbmp_zone.csv
  http://mis.nyiso.com/public/csv/realtime/YYYYMMDDrealtime_zone.csv

Idempotent: upserts on (iso, hub, market, interval_start).
"""
import csv
import io
import os
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

NY_TZ = ZoneInfo("America/New_York")
BASE_DAM = "http://mis.nyiso.com/public/csv/damlbmp/{date}damlbmp_zone.csv"
BASE_RT = "http://mis.nyiso.com/public/csv/realtime/{date}realtime_zone.csv"
LOOKBACK_DAYS = 5
MAX_RETRIES = 3

MARKETS = [
    {"name": "day_ahead", "url": BASE_DAM},
    {"name": "real_time", "url": BASE_RT},
]


def write_sync_log(sb, status, rows_inserted, start_t, errors):
    try:
        sb.table("sync_log").insert({
            "source": "nyiso_prices",
            "status": status,
            "rows_inserted": rows_inserted,
            "duration_ms": int((time.time() - start_t) * 1000),
            "error_message": ("; ".join(errors))[:500] if errors else None,
            "notes": f"NYISO zonal LBMP ({', '.join(m['name'] for m in MARKETS)}), {LOOKBACK_DAYS}d trailing window.",
        }).execute()
    except Exception as e:
        print(f"(could not write sync_log row: {e})")


def fetch_csv(url):
    backoff = 5
    for attempt in range(1, MAX_RETRIES + 1):
        resp = requests.get(url, timeout=45, headers={"User-Agent": "nukemap-nyiso-prices"})
        if resp.status_code == 404:
            return []
        if resp.status_code >= 500 and attempt < MAX_RETRIES:
            time.sleep(backoff)
            backoff *= 2
            continue
        resp.raise_for_status()
        text = resp.text.lstrip("\ufeff")
        reader = csv.DictReader(io.StringIO(text))
        return list(reader)
    return []


def parse_ts(ts):
    ts = ts.strip().strip('"')
    for fmt in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M"):
        try:
            local = datetime.strptime(ts, fmt).replace(tzinfo=NY_TZ)
            return local.astimezone(timezone.utc).isoformat()
        except ValueError:
            continue
    raise ValueError(f"unparseable timestamp: {ts}")


def main():
    start_t = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    errors = []
    records = []

    today = datetime.now(timezone.utc).astimezone(NY_TZ).date()
    days = [today - timedelta(days=i) for i in range(LOOKBACK_DAYS)]

    for market in MARKETS:
        for day in days:
            date_key = day.strftime("%Y%m%d")
            url = market["url"].format(date=date_key)
            try:
                rows = fetch_csv(url)
            except requests.exceptions.RequestException as e:
                errors.append(f"{market['name']} {date_key}: request_error: {e}")
                continue
            except Exception as e:
                errors.append(f"{market['name']} {date_key}: fetch_error: {type(e).__name__}: {e}")
                continue

            if not rows:
                continue

            bad_rows = 0
            for row in rows:
                try:
                    ts = parse_ts(row.get("Time Stamp", ""))
                    hub = (row.get("Name") or "").strip().strip('"')
                    price_raw = row.get("LBMP ($/MWHr)")
                    if not hub or price_raw in (None, ""):
                        bad_rows += 1
                        continue

                    records.append({
                        "iso": "NYISO",
                        "hub": hub,
                        "market": market["name"],
                        "interval_start": ts,
                        "price_usd_mwh": float(str(price_raw).replace(",", "")),
                    })
                except Exception:
                    bad_rows += 1

            if bad_rows:
                errors.append(f"{market['name']} {date_key}: skipped {bad_rows} malformed row(s)")

    written = 0
    if records:
        try:
            sb.table("wholesale_prices").upsert(
                records,
                on_conflict="iso,hub,market,interval_start",
            ).execute()
            written = len(records)
        except Exception as e:
            errors.append(f"upsert_error: {e}")

    status = "error" if errors else "success"
    write_sync_log(sb, status, written, start_t, errors)

    print(f"Done: wrote {written} NYISO rows" + (f" with {len(errors)} error(s)" if errors else ""))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
