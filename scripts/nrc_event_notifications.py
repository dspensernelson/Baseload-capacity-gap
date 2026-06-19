"""
NRC Event Notifications scraper — the live "something happened" wire.

Fetches the NRC daily Event Notification reports (the latest few days), parses each
event's labeled fields + narrative, best-effort matches the facility to our reactor
fleet, and upserts into `incidents` (keyed on event_number, so re-running is safe).

NB: written against NRC's documented event-report layout, but the exact HTML can only
be validated against a live fetch — which the dev sandbox can't reach (NRC blocks it),
only GitHub Actions can. So this is DEFENSIVE: it never crashes, always writes a
sync_log receipt, and when it parses suspiciously few events it stashes a raw text
sample in sync_log.notes so the parser can be corrected from the CI logs.

Run (in CI):  python scripts/nrc_event_notifications.py
"""
import os
import re
import sys
import time
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv
from supabase import create_client

try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None

UA = {"User-Agent": "Mozilla/5.0 (compatible; NukeMapBot/1.0; +https://nukemap-two.vercel.app)"}
BASE = "https://www.nrc.gov/reading-rm/doc-collections/event-status/event"
REPORT_DAYS = 6           # how many recent daily reports to ingest each run

load_dotenv()
SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get(url):
    for i in range(3):
        try:
            r = requests.get(url, headers=UA, timeout=30)
            if r.status_code == 200:
                return r.text
        except Exception:  # noqa: BLE001 — transient; retry
            pass
        time.sleep(3 * (i + 1))
    return None


def find_report_urls(limit=REPORT_DAYS):
    """Discover the most recent dated report files (YYYYMMDDen.html)."""
    year = datetime.now(timezone.utc).year
    found = {}
    for y in (year, year - 1):
        html = get(f"{BASE}/{y}/index") or get(f"{BASE}/{y}/")
        if html:
            for m in re.finditer(r'(\d{8})en\.html', html):
                found[m.group(1)] = f"{BASE}/{y}/{m.group(1)}en.html"
        if found:
            break
    urls = [found[d] for d in sorted(found, reverse=True)[:limit]]
    if not urls:                       # fall back to the "current" report
        urls = [f"{BASE}/en.html"]
    return urls


def _field(chunk, label):
    """Value on the same line as the label, or the next non-empty line."""
    m = re.search(rf'(?im){label}\s*:?\s*([^\n]*\S)?\s*\n?\s*([^\n]+)?', chunk)
    if not m:
        return None
    val = (m.group(1) or m.group(2) or "").strip()
    return val or None


def _date(s, fmt):
    if not s:
        return None
    try:
        return datetime.strptime(s.strip()[:10], fmt).date().isoformat()
    except ValueError:
        return None


def parse_report(html, report_date):
    if not html:
        return []
    text = re.sub(r'\r', '', BeautifulSoup(html, "html.parser").get_text("\n")) if BeautifulSoup else html
    # Each event notification starts with an "Event Number" label.
    chunks = re.split(r'(?im)^\s*Event\s+Number\s*:?\s*', text)[1:]
    events = []
    for chunk in chunks:
        mnum = re.match(r'\s*(\d{3,6})', chunk)
        if not mnum:
            continue
        en = mnum.group(1)
        mtext = re.search(r'(?is)Event\s+Text\s*:?\s*(.+?)(?:\n\s*\n\s*\n|\Z)', chunk)
        events.append({
            "event_number": en,
            "report_date": report_date,
            "facility": _field(chunk, "Facility"),
            "region": _field(chunk, "Region"),
            "state": _field(chunk, "State"),
            "unit": _field(chunk, "Unit"),
            "rx_type": _field(chunk, "RX Type"),
            "emergency_class": _field(chunk, "Emergency Class"),
            "notification_basis": _field(chunk, r"10\s*CFR"),
            "event_date": _date(_field(chunk, "Event Date"), "%m/%d/%Y"),
            "description": (mtext.group(1).strip()[:4000] if mtext else None),
            "source": "NRC Event Notification Report",
            "source_url": f"{BASE}/{(report_date or '').replace('-', '')[:4]}/{(report_date or '').replace('-', '')}en.html",
            "source_date": report_date,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        })
    return events


def build_reactor_matcher():
    rows = sb.table("reactors").select("id, plant_name").execute().data or []
    def norm(s):
        s = (s or "").lower()
        for w in ("nuclear", "generating", "station", "power", "plant", "energy", "center", "the"):
            s = s.replace(w, "")
        return re.sub(r'[^a-z0-9]', '', s)
    index = {}
    for r in rows:
        index.setdefault(norm(r["plant_name"]), r["id"])
    def match(facility):
        n = norm(facility)
        if not n:
            return None
        if n in index:
            return index[n]
        for k, rid in index.items():           # prefix / containment fallback
            if k and (k.startswith(n) or n.startswith(k)):
                return rid
        return None
    return match


def report_date_from_url(url):
    m = re.search(r'(\d{4})(\d{2})(\d{2})en\.html', url)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def main():
    started = datetime.now(timezone.utc)
    rows, sample = [], None
    try:
        match = build_reactor_matcher()
        for url in find_report_urls():
            rd = report_date_from_url(url)
            html = get(url)
            if html and sample is None:
                sample = re.sub(r'\s+', ' ', (BeautifulSoup(html, "html.parser").get_text(" ") if BeautifulSoup else html))[:600]
            for ev in parse_report(html, rd):
                ev["reactor_id"] = match(ev.get("facility"))
                rows.append(ev)

        # de-dup by event_number (latest report wins)
        dedup = {}
        for ev in rows:
            dedup[ev["event_number"]] = ev
        rows = list(dedup.values())

        inserted = 0
        if rows:
            sb.table("incidents").upsert(rows, on_conflict="event_number").execute()
            inserted = len(rows)

        low = inserted < 1
        sb.table("sync_log").insert({
            "source": "nrc_event_notifications",
            "status": "success" if not low else "partial",
            "rows_inserted": inserted,
            "duration_ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000),
            "notes": (f"PARSED 0 — check format. sample: {sample}" if low else f"upserted {inserted} event notifications"),
        }).execute()
        print(f"{'PARTIAL' if low else 'OK'} — {inserted} event notifications")
    except Exception as e:  # noqa: BLE001 — never crash the cron
        try:
            sb.table("sync_log").insert({
                "source": "nrc_event_notifications", "status": "error",
                "error_message": f"{type(e).__name__}: {str(e)[:400]}",
            }).execute()
        except Exception:
            pass
        print(f"ERROR: {e}")


if __name__ == "__main__":
    main()
    sys.exit(0)
