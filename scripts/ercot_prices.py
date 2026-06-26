"""
Ingest ERCOT real-time hub LMP pricing from the public MIS CDR endpoint
into wholesale_prices with no API key.

Source chain (public, no key):
  1) report listing: https://www.ercot.com/misapp/servlets/IceDocListJsonWS?reportTypeId=12300
  2) zip download:   https://www.ercot.com/misdownload/servlets/mirDownload?doclookupId=<DocID>

This report publishes every 5 minutes. We fetch only a short trailing publish
window each run, then upsert on (iso, hub, market, interval_start).
"""

import csv
import io
import json
import os
import time
import zipfile
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

DOC_LIST_URL = "https://www.ercot.com/misapp/servlets/IceDocListJsonWS"
DOWNLOAD_URL = "https://www.ercot.com/misdownload/servlets/mirDownload"
REPORT_TYPE_ID = 12300  # NP6-788: LMPs by Resource Nodes, Load Zones and Trading Hubs
MARKET = "real_time"
TARGET_HUBS = ["HB_HOUSTON", "HB_NORTH", "HB_SOUTH", "HB_WEST"]
LOOKBACK_MINUTES = 180
MAX_DOCS = 120
MAX_RETRIES = 3
REQUEST_TIMEOUT_S = 60
US_CENTRAL = ZoneInfo("America/Chicago")


def write_sync_log(sb, status, rows_inserted, start_t, errors, docs_seen, docs_downloaded):
    try:
        sb.table("sync_log").insert({
            "source": "ercot_prices",
            "status": status,
            "rows_inserted": rows_inserted,
            "duration_ms": int((time.time() - start_t) * 1000),
            "error_message": ("; ".join(errors))[:500] if errors else None,
            "notes": (
                f"ERCOT NP6-788 hub LMP ({MARKET}); docs seen={docs_seen}, "
                f"downloaded={docs_downloaded}; hubs={', '.join(TARGET_HUBS)}."
            ),
        }).execute()
    except Exception as e:
        print(f"(could not write sync_log row: {e})")


def ensure_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def parse_publish_ts(raw):
    return datetime.fromisoformat(str(raw))


def parse_interval_ts(raw):
    local = datetime.strptime(str(raw).strip(), "%m/%d/%Y %H:%M:%S").replace(tzinfo=US_CENTRAL)
    return local.astimezone(timezone.utc).isoformat()


def fetch_doc_list():
    params = {"reportTypeId": REPORT_TYPE_ID}
    resp = requests.get(
        DOC_LIST_URL,
        params=params,
        timeout=REQUEST_TIMEOUT_S,
        headers={"User-Agent": "nukemap-ercot-prices"},
    )
    resp.raise_for_status()
    payload = json.loads(resp.text)
    docs = payload.get("ListDocsByRptTypeRes", {}).get("DocumentList", [])
    out = []
    for item in ensure_list(docs):
        doc = (item or {}).get("Document", {})
        if not doc:
            continue
        friendly = str(doc.get("FriendlyName", ""))
        if not friendly.endswith("_csv"):
            continue
        doc_id = doc.get("DocID")
        publish_raw = doc.get("PublishDate")
        if not doc_id or not publish_raw:
            continue
        try:
            publish_at = parse_publish_ts(publish_raw)
        except ValueError:
            continue
        out.append({"doc_id": str(doc_id), "publish_at": publish_at, "friendly_name": friendly})
    out.sort(key=lambda x: x["publish_at"], reverse=True)
    return out


def download_doc_csv(doc_id):
    params = {"doclookupId": doc_id}
    backoff = 5
    for attempt in range(1, MAX_RETRIES + 1):
        resp = requests.get(
            DOWNLOAD_URL,
            params=params,
            timeout=REQUEST_TIMEOUT_S,
            headers={"User-Agent": "nukemap-ercot-prices"},
        )
        if resp.status_code >= 500 and attempt < MAX_RETRIES:
            time.sleep(backoff)
            backoff *= 2
            continue
        resp.raise_for_status()
        try:
            with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                csv_name = next(n for n in zf.namelist() if n.lower().endswith(".csv"))
                with zf.open(csv_name) as f:
                    return list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")))
        except StopIteration as e:
            raise ValueError("zip has no CSV payload") from e
        except zipfile.BadZipFile as e:
            body_prefix = resp.text[:200] if resp.text else ""
            raise ValueError(f"non-zip payload ({body_prefix})") from e
    return []


def main():
    start_t = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    errors = []

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=LOOKBACK_MINUTES)

    try:
        docs = fetch_doc_list()
    except Exception as e:
        errors.append(f"doc_list_error: {type(e).__name__}: {e}")
        write_sync_log(sb, "error", 0, start_t, errors, 0, 0)
        raise SystemExit(1)

    selected = [d for d in docs if d["publish_at"].astimezone(timezone.utc) >= cutoff][:MAX_DOCS]

    records = []
    docs_downloaded = 0
    for doc in selected:
        try:
            rows = download_doc_csv(doc["doc_id"])
            docs_downloaded += 1
        except requests.exceptions.RequestException as e:
            errors.append(f"doc {doc['doc_id']}: request_error: {e}")
            continue
        except Exception as e:
            errors.append(f"doc {doc['doc_id']}: parse_error: {type(e).__name__}: {e}")
            continue

        bad_rows = 0
        for row in rows:
            try:
                hub = str(row.get("SettlementPoint", "")).strip()
                if hub not in TARGET_HUBS:
                    continue
                ts_raw = row.get("SCEDTimestamp")
                price_raw = row.get("LMP")
                if ts_raw in (None, "") or price_raw in (None, ""):
                    bad_rows += 1
                    continue
                records.append({
                    "iso": "ERCOT",
                    "hub": hub,
                    "market": MARKET,
                    "interval_start": parse_interval_ts(ts_raw),
                    "price_usd_mwh": float(str(price_raw).replace(",", "")),
                })
            except Exception:
                bad_rows += 1

        if bad_rows:
            errors.append(f"doc {doc['doc_id']}: skipped {bad_rows} malformed row(s)")

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
    write_sync_log(sb, status, written, start_t, errors, len(selected), docs_downloaded)

    print(
        f"Done: wrote {written} ERCOT rows from {docs_downloaded}/{len(selected)} docs"
        + (f" with {len(errors)} error(s)" if errors else "")
    )
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
