"""
Ingest CAISO day-ahead hourly LMP (locational marginal price) for the two
benchmark trading hubs EIA's own wholesale-market report tracks (NP15, SP15)
into wholesale_prices. Pairs with the 2 a.m. test: prices spike the same hours
solar drops to zero in GridMix.

CAISO's OASIS system is free, public, and needs no API key or registration —
it's a regulatory-mandated public data system, built for exactly this. No EIA
key, no account, nothing to rotate.

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
LOOKBACK_DAYS = 5  # trailing window; idempotent upsert covers any missed runs


def fetch_hub(hub, start, end):
    params = {
        "resultformat": 6,
        "queryname": "PRC_LMP",
        "version": 12,
        "startdatetime": start.strftime("%Y%m%dT%H:%M-0000"),
        "enddatetime": end.strftime("%Y%m%dT%H:%M-0000"),
        "market_run_id": "DAM",
        "node": hub,
    }
    resp = requests.get(OASIS_URL, params=params, timeout=60,
                         headers={"User-Agent": "nukemap-caiso-prices"})
    resp.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        csv_name = next(n for n in zf.namelist() if n.endswith(".csv"))
        with zf.open(csv_name) as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
            return [row for row in reader if row.get("LMP_TYPE") == "LMP"]


def main():
    start_t = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=LOOKBACK_DAYS)

    records = []
    for hub in HUBS:
        rows = fetch_hub(hub, start, end)
        short_hub = hub.replace("TH_", "").replace("_GEN-APND", "")
        for r in rows:
            records.append({
                "iso": "CAISO",
                "hub": short_hub,
                "market": "day_ahead",
                "interval_start": r["INTERVALSTARTTIME_GMT"],
                "price_usd_mwh": float(r["MW"]),  # CAISO's CSV names the price column MW
            })
        print(f"  {hub}: {len(rows)} hourly rows")

    if records:
        sb.table("wholesale_prices").upsert(
            records, on_conflict="iso,hub,market,interval_start"
        ).execute()

    sb.table("sync_log").insert({
        "source":        "caiso_prices",
        "status":        "success",
        "rows_inserted": len(records),
        "duration_ms":   int((time.time() - start_t) * 1000),
        "notes":         f"CAISO day-ahead LMP, hubs {', '.join(HUBS)}, {LOOKBACK_DAYS}d trailing window.",
    }).execute()

    print(f"Done: upserted {len(records)} rows")


if __name__ == "__main__":
    main()
