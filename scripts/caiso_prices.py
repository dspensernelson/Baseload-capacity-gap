"""
Ingest CAISO day-ahead hourly LMP (locational marginal price) for the two
benchmark trading hubs EIA's own wholesale-market report tracks (NP15, SP15)
into wholesale_prices. Pairs with the 2 a.m. test: prices spike the same hours
solar drops to zero in GridMix.

CAISO's OASIS system is free, public, and needs no API key or registration —
it's a regulatory-mandated public data system, built for exactly this. No EIA
key, no account, nothing to rotate. It does rate-limit back-to-back requests
(observed: a second request immediately after the first gets HTTP 429) — each
hub is fetched with a retry/backoff, and written to the table immediately
after fetching, so one hub's success isn't lost if another hub fails.

Pilot scope (see ADR-0015): CAISO only, day-ahead market only. `iso`/`market`
are real columns so another ISO or real-time prices is a new script writing
into the same table later, not a schema change.

Idempotent: upserts on (iso, hub, market, interval_start), so re-running just
refreshes the trailing window.

Run:  python scripts/caiso_prices.py
"""
import io
import os
import time
import zipfile
import csv
import requests
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

OASIS_URL = "https://oasis.caiso.com/oasisapi/SingleZip"
HUBS = ["TH_NP15_GEN-APND", "TH_SP15_GEN-APND"]
LOOKBACK_DAYS_DA = 5   # trailing window; idempotent upsert covers any missed runs
LOOKBACK_DAYS_RT = 2   # realtime is denser (5-min), keep a tighter refresh window
HUB_DELAY_S = 8        # spacing between requests to avoid CAISO's rate limit
MAX_RETRIES = 4

MARKETS = [
    {
        "name": "day_ahead",
        "queryname": "PRC_LMP",
        "version": 12,
        "market_run_id": "DAM",
        "lookback_days": LOOKBACK_DAYS_DA,
        "price_keys": ["MW", "VALUE"],
    },
    {
        "name": "real_time",
        "queryname": "PRC_INTVL_LMP",
        "version": 3,
        "market_run_id": "RTM",
        "lookback_days": LOOKBACK_DAYS_RT,
        "price_keys": ["VALUE", "MW"],
    },
]


def fetch_hub(hub, market, start, end):
    params = {
        "resultformat": 6,
        "queryname": market["queryname"],
        "version": market["version"],
        "startdatetime": start.strftime("%Y%m%dT%H:%M-0000"),
        "enddatetime": end.strftime("%Y%m%dT%H:%M-0000"),
        "market_run_id": market["market_run_id"],
        "node": hub,
    }
    backoff = 15
    for attempt in range(1, MAX_RETRIES + 1):
        resp = requests.get(OASIS_URL, params=params, timeout=60,
                             headers={"User-Agent": "nukemap-caiso-prices"})
        if resp.status_code == 429 and attempt < MAX_RETRIES:
            print(f"    {hub}: 429 rate-limited (attempt {attempt}/{MAX_RETRIES}), waiting {backoff}s…")
            time.sleep(backoff)
            backoff *= 2
            continue
        resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            csv_name = next(n for n in zf.namelist() if n.endswith(".csv"))
            with zf.open(csv_name) as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
                return [row for row in reader if row.get("LMP_TYPE") == "LMP"]
    return []


def write_sync_log(sb, status, total_written, start_t, errors):
    try:
        sb.table("sync_log").insert({
            "source":        "caiso_prices",
            "status":        status,
            "rows_inserted": total_written,
            "duration_ms":   int((time.time() - start_t) * 1000),
            "error_message": ("; ".join(errors))[:500] if errors else None,
            "notes":         f"CAISO pricing markets {', '.join(m['name'] for m in MARKETS)}, hubs {', '.join(HUBS)}.",
        }).execute()
    except Exception as e:
        print(f"(could not write sync_log row: {e})")


def main():
    start_t = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    now = datetime.now(timezone.utc)

    total_written = 0
    errors = []
    for market in MARKETS:
        end = now
        start = end - timedelta(days=market["lookback_days"])
        print(f"Market {market['name']}: {start.isoformat()} -> {end.isoformat()}")
        for i, hub in enumerate(HUBS):
            if i > 0:
                time.sleep(HUB_DELAY_S)
            short_hub = hub.replace("TH_", "").replace("_GEN-APND", "")
            try:
                rows = fetch_hub(hub, market, start, end)
            except requests.exceptions.RequestException as e:
                print(f"  {hub} ({market['name']}): FAILED ({e})")
                errors.append(f"{short_hub} {market['name']}: {e}")
                continue
            except (zipfile.BadZipFile, csv.Error) as e:
                print(f"  {hub} ({market['name']}): FAILED to parse response ({e})")
                errors.append(f"{short_hub} {market['name']}: parse_error: {e}")
                continue
            except Exception as e:
                print(f"  {hub} ({market['name']}): FAILED unexpectedly ({type(e).__name__}: {e})")
                errors.append(f"{short_hub} {market['name']}: unexpected_error: {type(e).__name__}: {e}")
                continue

            records = []
            bad_rows = 0
            for r in rows:
                if r.get("LMP_TYPE") != "LMP":
                    continue
                try:
                    raw_price = next((r.get(k) for k in market["price_keys"] if r.get(k) not in (None, "")), None)
                    if raw_price is None:
                        bad_rows += 1
                        continue
                    records.append({
                        "iso": "CAISO",
                        "hub": short_hub,
                        "market": market["name"],
                        "interval_start": r["INTERVALSTARTTIME_GMT"],
                        "price_usd_mwh": float(raw_price),
                    })
                except (KeyError, TypeError, ValueError):
                    bad_rows += 1

            if bad_rows:
                errors.append(f"{short_hub} {market['name']}: skipped {bad_rows} malformed row(s)")

            if records:
                try:
                    sb.table("wholesale_prices").upsert(
                        records, on_conflict="iso,hub,market,interval_start"
                    ).execute()
                except Exception as e:
                    errors.append(f"{short_hub} {market['name']}: upsert_error: {e}")
                    print(f"  {hub} ({market['name']}): FAILED write ({e})")
                    continue
            total_written += len(records)
            print(f"  {hub} ({market['name']}): {len(records)} rows written")

    status = "error" if errors else "success"
    write_sync_log(sb, status, total_written, start_t, errors)

    print(f"Done: wrote {total_written} rows total" + (f", {len(errors)} hub(s) failed" if errors else ""))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
