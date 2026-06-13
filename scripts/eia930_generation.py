"""
Ingest EIA-930 hourly generation by fuel type for the U.S. Lower 48 (respondent
US48) into generation_hourly. Powers the "2 a.m." grid-mix view: at night solar
goes to zero while nuclear holds flat.

Free: uses the EIA API key (EIA_API_KEY). Idempotent: upserts on
(period_utc, fueltype), so re-running just refreshes the trailing window.

Run:  python scripts/eia930_generation.py
"""
import os
import time
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
EIA_API_KEY          = os.environ["EIA_API_KEY"]
SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

# ~5 days of trailing hourly data (≈ 100 hours × ~15 fuel types).
LENGTH = 2000
CHUNK  = 500
EIA_URL = "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/"


def fetch_rows():
    params = {
        "api_key": EIA_API_KEY,
        "frequency": "hourly",
        "data[0]": "value",
        "facets[respondent][]": "US48",
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": LENGTH,
    }
    resp = requests.get(EIA_URL, params=params, timeout=60,
                        headers={"User-Agent": "nukemap-eia930"})
    resp.raise_for_status()
    return resp.json()["response"]["data"]


def main():
    start = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("Fetching EIA-930 US48 hourly generation…")
    rows = fetch_rows()
    print(f"  {len(rows)} raw rows")

    records, seen = [], set()
    for r in rows:
        period = (r.get("period") or "").strip()
        ft = (r.get("fueltype") or "").strip()
        val = r.get("value")
        if not period or not ft or val in (None, ""):
            continue
        key = (period, ft)
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "period_utc": f"{period}:00:00+00:00",
            "fueltype": ft,
            "mwh": float(val),
        })

    for i in range(0, len(records), CHUNK):
        sb.table("generation_hourly").upsert(
            records[i:i + CHUNK], on_conflict="period_utc,fueltype"
        ).execute()

    latest = max((r["period_utc"] for r in records), default=None)
    duration = int((time.time() - start) * 1000)
    sb.table("sync_log").insert({
        "source": "eia930_generation",
        "status": "success",
        "rows_inserted": len(records),
        "duration_ms": duration,
        "notes": f"US48 hourly generation; latest period {latest}; {len(seen)} (period,fuel) rows.",
    }).execute()

    print(f"Done: upserted {len(records)} rows, latest {latest}")


if __name__ == "__main__":
    main()
