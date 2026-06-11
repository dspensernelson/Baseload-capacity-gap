"""
Fetches the NRC daily power reactor status file, matches plant names to
our Supabase reactors table, updates daily_status, and writes to sync_log.
"""
import os
import time
import difflib
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

# Case-sensitive: the lowercase URL serves an HTML meta-refresh page, not the data
NRC_URL = (
    "https://www.nrc.gov/reading-rm/doc-collections/event-status/"
    "reactor-status/PowerReactorStatusForLast365Days.txt"
)

# Manual overrides where NRC name doesn't fuzzy-match the EIA plant_name in the DB.
# Keys are normalized NRC plant names (unit number already split off); values are
# exact reactors.plant_name strings.
NAME_MAP = {
    "arkansas nuclear":  "Arkansas Nuclear One",
    "braidwood":         "Braidwood Generation Station",
    "browns ferry":      "Browns Ferry",
    "brunswick":         "Brunswick Nuclear",
    "byron":             "Byron Generating Station",
    "calvert cliffs":    "Calvert Cliffs Nuclear Power Plant",
    "clinton":           "Clinton Power Station",
    "columbia":          "Columbia Generating Station",
    "cooper":            "Cooper Nuclear Station",
    "d.c. cook":         "Donald C Cook",
    "davis-besse":       "Davis Besse",
    "dresden":           "Dresden Generating Station",
    "farley":            "Joseph M Farley",
    "fitzpatrick":       "James A Fitzpatrick",
    "ginna":             "R E Ginna Nuclear Power Plant",
    "harris":            "Harris (NC)",
    "hatch":             "Edwin I Hatch",
    "hope creek":        "PSEG Hope Creek Generating Station",
    "lasalle":           "LaSalle Generating Station",
    "monticello":        "Monticello Nuclear Facility",
    "nine mile point":   "Nine Mile Point Nuclear Station",
    "point beach":       "Point Beach Nuclear Plant",
    "quad cities":       "Quad Cities Generating Station",
    "robinson":          "H B Robinson",
    "salem":             "PSEG Salem Generating Station",
    "st. lucie":         "St Lucie",
    "summer":            "V C Summer",
    "v.c. summer":       "V C Summer",
    "susquehanna":       "TalenEnergy Susquehanna",
    "waterford":         "Waterford 3",
    "watts bar":         "Watts Bar Nuclear Plant",
    "wolf creek":        "Wolf Creek Generating Station",
}

STRIP_SUFFIXES = [
    " nuclear power plant", " nuclear power station",
    " nuclear generating station", " nuclear", " power plant",
    " generating station",
]


def normalize(name: str) -> str:
    n = name.lower().strip()
    for suffix in STRIP_SUFFIXES:
        if n.endswith(suffix):
            n = n[: -len(suffix)].strip()
    return n


def fetch_nrc_data():
    resp = requests.get(NRC_URL, timeout=30)
    resp.raise_for_status()
    lines = resp.text.splitlines()

    # Find header line (contains "Unit")
    header_idx = next(i for i, l in enumerate(lines) if "Unit" in l and "Power" in l)
    header = [h.strip() for h in lines[header_idx].split("|")]

    rows = []
    for line in lines[header_idx + 1:]:
        if not line.strip() or line.startswith("-"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < len(header):
            continue
        rows.append(dict(zip(header, parts)))

    return rows


def parse_report_date(date_str):
    # ReportDt looks like "6/10/2026 12:00:00 AM"
    for fmt in ("%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y"):
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            pass
    return None


def get_today_rows(rows):
    """Return (latest_report_date, rows_for_that_date)."""
    if not rows:
        return None, []
    dated = []
    for r in rows:
        d = parse_report_date(r.get("ReportDt", "").strip())
        if d:
            dated.append((d, r))
    if not dated:
        return None, []
    latest = max(d for d, _ in dated)
    return latest, [r for d, r in dated if d == latest]


def parse_power(power_str):
    """NRC 'Power' is an integer percent; non-numeric notes become None."""
    return int(power_str) if power_str.isdigit() else None


def split_unit_field(unit_field: str) -> tuple[str, str]:
    # NRC "Unit" column combines plant and unit, e.g. "Browns Ferry 1" or "Clinton"
    parts = unit_field.rsplit(" ", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0], parts[1]
    return unit_field, ""


def match_plant(nrc_name: str, nrc_unit: str, plant_names: list[str]) -> str | None:
    key = f"{normalize(nrc_name)} {nrc_unit}".strip()
    if key in NAME_MAP:
        return NAME_MAP[key]
    key2 = normalize(nrc_name)
    if key2 in NAME_MAP:
        return NAME_MAP[key2]

    # Fuzzy match against known EIA plant names
    norm_names = {normalize(n): n for n in plant_names}
    matches = difflib.get_close_matches(key2, norm_names.keys(), n=1, cutoff=0.6)
    if matches:
        return norm_names[matches[0]]
    return None


def main():
    start = time.time()
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Load all operating reactors
    result = supabase.table("reactors").select("id, plant_name, unit_number, status").execute()
    db_reactors = result.data
    plant_names = list({r["plant_name"] for r in db_reactors})

    print("Fetching NRC status file…")
    try:
        all_rows = fetch_nrc_data()
        report_date, today_rows = get_today_rows(all_rows)
        print(f"  Found {len(today_rows)} units for {report_date}")
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        supabase.table("sync_log").insert({
            "source": "nrc_daily_status", "status": "error",
            "error_message": str(e), "duration_ms": duration,
        }).execute()
        print(f"ERROR: {e}")
        raise SystemExit(1)

    unmatched     = []
    updates       = 0
    history_rows  = []
    now           = datetime.now(timezone.utc).isoformat()
    report_iso    = report_date.isoformat() if report_date else None

    for row in today_rows:
        nrc_name, nrc_unit = split_unit_field(row.get("Unit", "").strip())
        power = row.get("Power", "").strip()

        matched_name = match_plant(nrc_name, nrc_unit, plant_names)
        if not matched_name:
            unmatched.append(f"{nrc_name} {nrc_unit}")
            continue

        # Find matching DB row(s) — unit numbers sometimes differ
        candidates = [r for r in db_reactors if r["plant_name"] == matched_name]
        if not candidates:
            unmatched.append(f"{nrc_name} {nrc_unit} (plant not in DB)")
            continue

        # Match by unit number if possible
        match_by_unit = [r for r in candidates if r["unit_number"] == nrc_unit]
        targets = match_by_unit if match_by_unit else candidates

        status_str = f"{power}% power" if power.isdigit() else power
        power_pct  = parse_power(power)

        for reactor in targets:
            supabase.table("reactors").update({
                "daily_status": status_str,
                "daily_status_updated_at": now,
            }).eq("id", reactor["id"]).execute()
            updates += 1

            if report_iso:
                history_rows.append({
                    "reactor_id":  reactor["id"],
                    "report_date": report_iso,
                    "power_pct":   power_pct,
                    "status_text": status_str,
                })

    # Append today's readings to the history tape (idempotent on reactor_id+date)
    inserted = 0
    if history_rows:
        supabase.table("daily_status_history").upsert(
            history_rows, on_conflict="reactor_id,report_date"
        ).execute()
        inserted = len(history_rows)

    duration = int((time.time() - start) * 1000)
    supabase.table("sync_log").insert({
        "source":        "nrc_daily_status",
        "status":        "success",
        "rows_updated":  updates,
        "rows_inserted": inserted,
        "duration_ms":   duration,
        "notes":         f"Report {report_iso}. History rows: {inserted}. Unmatched: {len(unmatched)}. Names: {', '.join(unmatched[:10])}",
    }).execute()

    print(f"Done: {updates} reactors updated, {inserted} history rows, {len(unmatched)} unmatched")
    if unmatched:
        print("  Unmatched plant names (add to NAME_MAP):")
        for u in unmatched:
            print(f"    {u}")


if __name__ == "__main__":
    main()
