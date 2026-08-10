"""
Ingest NYISO zonal LBMP pricing (day-ahead and real-time) from public MIS CSV feeds
into wholesale_prices with no API key.

Sources (public, no key):
  http://mis.nyiso.com/public/csv/damlbmp/YYYYMMDDdamlbmp_zone.csv
  http://mis.nyiso.com/public/csv/realtime/YYYYMMDDrealtime_zone.csv

Idempotent: upserts on (iso, hub, market, interval_start).

Exit-code contract (ADR-0016): exit 1 means THE FEED FAILED — nothing landed.
A skipped malformed row or one unavailable day-file is a warning: it is printed,
recorded in sync_log, and the run still exits 0. Sustained silence is the
watchdog's job, not the exit code's.
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


def write_sync_log(sb, status, rows_inserted, start_t, fatal, warnings):
    note = f"NYISO zonal LBMP ({', '.join(m['name'] for m in MARKETS)}), {LOOKBACK_DAYS}d trailing window."
    if warnings:
        note += " Non-fatal: " + "; ".join(warnings)
    try:
        sb.table("sync_log").insert({
            "source": "nyiso_prices",
            "status": status,
            "rows_inserted": rows_inserted,
            "duration_ms": int((time.time() - start_t) * 1000),
            "error_message": ("; ".join(fatal))[:500] if fatal else None,
            "notes": note[:1000],
        }).execute()
    except Exception as e:
        print(f"(could not write sync_log row: {e})")


def fetch_csv(url):
    backoff = 5
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, timeout=45, headers={"User-Agent": "nukemap-nyiso-prices"})
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            # DNS/connection blips on the runner are as transient as a 5xx — the
            # retry ladder exists for exactly this, so don't skip it (they used to
            # go straight to fatal; see the CAISO name-resolution failures, July 2026).
            if attempt < MAX_RETRIES:
                time.sleep(backoff)
                backoff *= 2
                continue
            raise
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
    fatal, warnings = [], []
    records = []
    fetches_ok = fetches_failed = 0

    today = datetime.now(timezone.utc).astimezone(NY_TZ).date()
    days = [today - timedelta(days=i) for i in range(LOOKBACK_DAYS)]

    for market in MARKETS:
        for day in days:
            date_key = day.strftime("%Y%m%d")
            url = market["url"].format(date=date_key)
            try:
                rows = fetch_csv(url)
                fetches_ok += 1
            except requests.exceptions.RequestException as e:
                fetches_failed += 1
                warnings.append(f"{market['name']} {date_key}: request_error: {e}")
                continue
            except Exception as e:
                fetches_failed += 1
                warnings.append(f"{market['name']} {date_key}: fetch_error: {type(e).__name__}: {e}")
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
                warnings.append(f"{market['name']} {date_key}: skipped {bad_rows} malformed row(s)")

    written = 0
    if records:
        try:
            sb.table("wholesale_prices").upsert(
                records,
                on_conflict="iso,hub,market,interval_start",
            ).execute()
            written = len(records)
        except Exception as e:
            fatal.append(f"upsert_error: {e}")

    # Fatal only when the feed as a whole produced nothing usable. A 5-day
    # window means single-day gaps can't trip this.
    if fetches_ok == 0:
        fatal.append(f"every NYISO fetch failed ({fetches_failed} attempt(s)) — source unreachable.")
    elif not records:
        fatal.append("NYISO returned no usable rows across the whole lookback window.")

    status = "error" if fatal else ("partial" if warnings else "success")
    write_sync_log(sb, status, written, start_t, fatal, warnings)

    for w in warnings:
        print(f"  warning: {w}")
    for f in fatal:
        print(f"  ERROR: {f}")
    print(
        f"Done [{status}]: wrote {written} NYISO rows from {fetches_ok}/{fetches_ok + fetches_failed} fetches"
        + (f", {len(warnings)} warning(s)" if warnings else "")
    )
    if fatal:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
