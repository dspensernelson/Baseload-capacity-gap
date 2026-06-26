"""
Ingest PJM day-ahead hourly LMP into wholesale_prices for two benchmark zones
(WEST, MIDATL) via PJM Data Miner 2 API.

This follows the same reliability contract as CAISO ingestion:
- idempotent upsert on (iso, hub, market, interval_start)
- one source's partial failures still preserve successful writes
- every run attempts to write a sync_log receipt

Requires:
  SUPABASE_URL
  SUPABASE_SERVICE_KEY
  PJM_API_KEY (PJM API subscription key)

Run:
  python scripts/pjm_prices.py
"""
import os
import time
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
PJM_API_KEY = os.environ.get("PJM_API_KEY", "").strip()

PJM_URL = "https://api.pjm.com/api/v1/da_hrl_lmps"
TARGET_ZONES = ["WEST", "MIDATL"]
LOOKBACK_DAYS = 3
MAX_RETRIES = 4
PAGE_SIZE = 50000
MAX_PAGES = 8


def parse_bool(v):
    if isinstance(v, bool):
        return v
    if v is None:
        return False
    return str(v).strip().lower() in ("true", "1", "yes", "y")


def first_present(row, keys):
    for k in keys:
        if k in row and row[k] is not None and row[k] != "":
            return row[k]
    return None


def request_json(session, params):
    backoff = 10
    for attempt in range(1, MAX_RETRIES + 1):
        resp = session.get(PJM_URL, params=params, timeout=60)
        if resp.status_code == 429 and attempt < MAX_RETRIES:
            print(f"    PJM: 429 rate-limited (attempt {attempt}/{MAX_RETRIES}), waiting {backoff}s")
            time.sleep(backoff)
            backoff *= 2
            continue
        resp.raise_for_status()
        return resp.json()
    return None


def write_sync_log(sb, status, rows_inserted, start_t, errors):
    try:
        sb.table("sync_log").insert({
            "source": "pjm_prices",
            "status": status,
            "rows_inserted": rows_inserted,
            "duration_ms": int((time.time() - start_t) * 1000),
            "error_message": ("; ".join(errors))[:500] if errors else None,
            "notes": f"PJM day-ahead LMP zones {', '.join(TARGET_ZONES)}, {LOOKBACK_DAYS}d trailing window.",
        }).execute()
    except Exception as e:
        print(f"(could not write sync_log row: {e})")


def main():
    start_t = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    errors = []
    total_written = 0

    if not PJM_API_KEY:
        write_sync_log(sb, "success", 0, start_t, ["skipped: missing PJM_API_KEY"])
        print("PJM_API_KEY not configured. PJM ingest skipped by design.")
        return

    end_utc = datetime.now(timezone.utc)
    start_utc = end_utc - timedelta(days=LOOKBACK_DAYS)

    session = requests.Session()
    session.headers.update({
        "Ocp-Apim-Subscription-Key": PJM_API_KEY,
        "Accept": "application/json",
        "User-Agent": "nukemap-pjm-prices",
    })

    rows = []
    try:
        for page in range(MAX_PAGES):
            params = {
                "rowCount": PAGE_SIZE,
                "startRow": page * PAGE_SIZE + 1,
                "sort": "datetime_beginning_utc",
                "order": "Asc",
                # Keep payload bounded to the trailing window.
                "datetime_beginning_utc": f">={start_utc.isoformat().replace('+00:00', 'Z')}",
            }
            payload = request_json(session, params)
            if payload is None:
                break

            if isinstance(payload, list):
                page_rows = payload
            elif isinstance(payload, dict):
                page_rows = payload.get("items") or payload.get("data") or payload.get("rows") or []
            else:
                page_rows = []

            if not page_rows:
                break

            rows.extend(page_rows)
            if len(page_rows) < PAGE_SIZE:
                break
    except requests.exceptions.RequestException as e:
        errors.append(f"request_error: {e}")
    except ValueError as e:
        errors.append(f"json_error: {e}")
    except Exception as e:
        errors.append(f"unexpected_error: {type(e).__name__}: {e}")

    records = []
    skipped = 0
    for row in rows:
        try:
            ts = first_present(row, ["datetime_beginning_utc", "datetimeBeginningUtc"])
            zone = first_present(row, ["transmission_zone", "transmissionZone"])
            lmp = first_present(row, ["total_lmp_da", "totalLmpDa"])
            latest = first_present(row, ["latest_version", "latestVersion"])

            if not ts or zone not in TARGET_ZONES:
                continue
            if latest is not None and not parse_bool(latest):
                continue

            ts_dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            if ts_dt < start_utc:
                continue
            if ts_dt > end_utc + timedelta(hours=48):
                continue

            records.append({
                "iso": "PJM",
                "hub": zone,
                "market": "day_ahead",
                "interval_start": ts_dt.isoformat(),
                "price_usd_mwh": float(lmp),
            })
        except (TypeError, ValueError):
            skipped += 1

    if skipped:
        errors.append(f"skipped {skipped} malformed row(s)")

    if records:
        try:
            sb.table("wholesale_prices").upsert(
                records,
                on_conflict="iso,hub,market,interval_start",
            ).execute()
            total_written = len(records)
        except Exception as e:
            errors.append(f"upsert_error: {e}")

    status = "error" if errors else "success"
    write_sync_log(sb, status, total_written, start_t, errors)

    print(f"Done: wrote {total_written} PJM rows" + (f" with {len(errors)} error(s)" if errors else ""))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
