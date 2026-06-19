"""
NRC Event Notifications scraper — the live "something happened" wire.

Fetches the NRC daily Event Notification reports (the latest few days), parses each
event, keeps the ones tied to a licensed FACILITY (i.e. reactor/plant events, not
Agreement-State materials/medical reports), best-effort matches the facility to our
reactor fleet, and upserts into `incidents` (keyed on event_number, so re-running is
safe). Writes a sync_log receipt; never crashes the cron.

NRC layout (learned from a live fetch): each event is a flat list of "Label:" lines
whose VALUE is on the following line(s); "Event Text" (no colon) is followed by the
multi-paragraph narrative until the next "Event Number".
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
REPORT_DAYS = 8

LABELS = ("Event Number", "Rep Org", "Licensee", "Facility", "Region", "City", "State",
          "County", "License #", "Agreement", "Docket", "NRC Notified By", "HQ OPS Officer",
          "Notification Date", "Notification Time", "Event Date", "Event Time", "Last Update Date",
          "Emergency Class", "10 CFR Section", "Person (Organization)", "Unit", "RX Type",
          "Scram Code", "Initial PWR", "Initial RX Mode", "Current PWR", "Current RX Mode", "Event Text")
_LABEL_RE = re.compile(r'^\s*(' + '|'.join(re.escape(l) for l in LABELS) + r')\s*:?\s*(.*)$')

load_dotenv()
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


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


def _clean(s):
    if s is None:
        return None
    s = re.sub(r'\s+', ' ', s.replace('\x00', ' ')).strip()
    return s or None


def _date(s, fmt="%m/%d/%Y"):
    if not s:
        return None
    try:
        return datetime.strptime(s.strip()[:10], fmt).date().isoformat()
    except ValueError:
        return None


def find_report_urls(limit=REPORT_DAYS):
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
    return urls or [f"{BASE}/en.html"]


def parse_report(html, report_date):
    if not html:
        return []
    text = (BeautifulSoup(html, "html.parser").get_text("\n") if BeautifulSoup else html).replace('\x00', ' ')

    # Walk lines into per-event {label: value} dicts. Value lines follow their label;
    # once inside "Event Text", everything up to the next "Event Number" is narrative.
    blocks, cur, field = [], None, None
    for ln in text.split("\n"):
        m = _LABEL_RE.match(ln)
        lab = m.group(1) if m else None
        if lab == "Event Number":
            if cur:
                blocks.append(cur)
            cur, field = {"Event Number": m.group(2).strip()}, None
            continue
        if cur is None:
            continue
        if field == "Event Text" and lab != "Event Number":
            if ln.strip():
                cur["Event Text"] = (cur.get("Event Text", "") + " " + ln.strip()).strip()
            continue
        if lab:
            field = lab
            cur[lab] = m.group(2).strip()
        elif field and ln.strip():
            cur[field] = (cur.get(field, "") + " " + ln.strip()).strip()
    if cur:
        blocks.append(cur)

    recs = []
    for e in blocks:
        facility = _clean(e.get("Facility"))
        if not facility:                       # skip Agreement-State materials/medical reports
            continue
        yyyymmdd = (report_date or "").replace("-", "")
        recs.append({
            "event_number": _clean(e.get("Event Number")),
            "report_date": report_date,
            "facility": facility,
            "state": _clean(e.get("State")),
            "unit": _clean(e.get("Unit")),
            "rx_type": _clean(e.get("RX Type")),
            "region": _clean(e.get("Region")),
            "emergency_class": _clean(e.get("Emergency Class")),
            "notification_basis": _clean(e.get("10 CFR Section")),
            "event_date": _date(_clean(e.get("Event Date"))),
            "description": (_clean(e.get("Event Text")) or "")[:4000] or None,
            "source": "NRC Event Notification Report",
            "source_url": f"{BASE}/{yyyymmdd[:4]}/{yyyymmdd}en.html" if yyyymmdd else f"{BASE}/index",
            "source_date": report_date,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        })
    return recs


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
        for k, rid in index.items():
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
            html = get(url)
            if html and sample is None:
                sample = re.sub(r'\s+', ' ', (BeautifulSoup(html, "html.parser").get_text(" ") if BeautifulSoup else html))[:500]
            for ev in parse_report(html, report_date_from_url(url)):
                ev["reactor_id"] = match(ev.get("facility"))
                rows.append(ev)

        dedup = {}
        for ev in rows:
            if ev.get("event_number"):
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
            "notes": (f"PARSED 0 facility events. sample: {sample}" if low else f"upserted {inserted} plant event notifications"),
        }).execute()
        print(f"{'PARTIAL' if low else 'OK'} — {inserted} plant event notifications")
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
