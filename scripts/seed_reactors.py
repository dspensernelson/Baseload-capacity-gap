import os
import time
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

EIA_API_KEY = os.environ["EIA_API_KEY"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

EIA_BASE = "https://api.eia.gov/v2/electricity/operating-generator-capacity/data"


def fetch_all_nuclear_units():
    """Fetch the most recent monthly snapshot of operating nuclear generators."""
    rows = []
    latest_period = None
    offset = 0
    length = 100

    while True:
        params = {
            "api_key": EIA_API_KEY,
            "facets[technology][]": "Nuclear",
            "facets[status][]": "OP",
            "data[]": [
                "nameplate-capacity-mw",
                "operating-year-month",
                "latitude",
                "longitude",
            ],
            "sort[0][column]": "period",
            "sort[0][direction]": "desc",
            "length": length,
            "offset": offset,
        }
        resp = requests.get(EIA_BASE, params=params)
        resp.raise_for_status()
        data = resp.json()["response"]["data"]

        if not data:
            break

        # Lock onto the first period seen and stop when it changes
        if latest_period is None:
            latest_period = data[0]["period"]
            print(f"  Using period: {latest_period}")

        period_rows = [r for r in data if r["period"] == latest_period]
        rows.extend(period_rows)

        if len(period_rows) < len(data):
            # Period changed mid-page — we have everything
            break
        if len(data) < length:
            break

        offset += length
        time.sleep(0.3)

    return rows


def map_to_reactor(row):
    oym = row.get("operating-year-month")  # format: "YYYY-MM"
    cod = f"{oym[:4]}-01-01" if oym else None

    return {
        "eia_plant_id": str(row["plantid"]),
        "unit_number":  str(row["generatorid"]),
        "plant_name":   row["plantName"],
        "operator":     row.get("entityName"),
        "state":        row.get("stateid"),
        "iso_rto":      row.get("balancing_authority_code"),
        "latitude":     row.get("latitude"),
        "longitude":    row.get("longitude"),
        "capacity_mw":  row.get("nameplate-capacity-mw"),
        "commercial_operation_date": cod,
        "status":       "operating",
    }


def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("Fetching nuclear units from EIA...")
    raw_rows = fetch_all_nuclear_units()
    print(f"  Fetched {len(raw_rows)} rows from EIA")

    records = [map_to_reactor(r) for r in raw_rows]

    result = (
        supabase.table("reactors")
        .upsert(records, on_conflict="eia_plant_id,unit_number")
        .execute()
    )

    print(f"Done: {len(result.data)} rows upserted")


if __name__ == "__main__":
    main()
