"""
Roll real-time wholesale_prices rows older than the retention window up to hourly
avg/min/max in wholesale_prices_hourly, then delete the raw rows.

The work happens in one SQL function (supabase/wholesale_prices_hourly.sql,
rollup_wholesale_prices): a single DELETE ... RETURNING statement feeds the
aggregate, so every raw row removed is a row that was counted, and a failure
leaves both tables untouched. This script only calls it and writes the receipt.

Exit-code contract (ADR-0016): exit 1 means the rollup FAILED. A run with nothing
old enough to roll up is a normal success (0 rows), not a failure.

Run:
  python scripts/rollup_wholesale_prices.py
"""

import os
import time

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

# Full-resolution window. The site reads the last 48h (WholesalePrices.jsx); 30d
# leaves room to inspect a recent event at 5-minute detail before it is rolled up.
RETAIN_DAYS = 30


def write_sync_log(sb, status, rows_inserted, start_t, error, notes):
    try:
        sb.table("sync_log").insert({
            "source": "rollup_wholesale_prices",
            "status": status,
            "rows_inserted": rows_inserted,
            "duration_ms": int((time.time() - start_t) * 1000),
            "error_message": error[:500] if error else None,
            "notes": notes[:1000],
        }).execute()
    except Exception as e:  # noqa: BLE001
        print(f"(could not write sync_log row: {e})")


def main():
    start_t = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    try:
        resp = sb.rpc("rollup_wholesale_prices", {"retain_days": RETAIN_DAYS}).execute()
        row = (resp.data or [{}])[0]
        removed = int(row.get("raw_rows_removed") or 0)
        written = int(row.get("hour_rows_written") or 0)
        cutoff = row.get("cutoff")
    except Exception as e:  # noqa: BLE001
        msg = f"{type(e).__name__}: {e}"
        print(f"Rollup failed: {msg}")
        write_sync_log(sb, "error", 0, start_t, msg, f"rollup failed; retain_days={RETAIN_DAYS}")
        raise SystemExit(1)

    notes = (f"rolled {removed} real-time rows older than {cutoff} (retain {RETAIN_DAYS}d) "
             f"into {written} hourly rows")
    print(notes)
    write_sync_log(sb, "success", written, start_t, None, notes)


if __name__ == "__main__":
    main()
