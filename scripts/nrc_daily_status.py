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

NRC_URL = (
    "https://www.nrc.gov/reading-rm/doc-collections/event-status/"
    "reactor-status/powerreactorstatusforlast365days.txt"
)

# Manual overrides where NRC name doesn't fuzzy-match EIA name
NAME_MAP = {
    "browns ferry 1":          "Browns Ferry",
    "browns ferry 2":          "Browns Ferry",
    "browns ferry 3":          "Browns Ferry",
    "robinson":                "Robinson",
    "h.b. robinson":           "Robinson",
    "hatch":                   "Edwin I. Hatch",
    "harris":                  "Harris",
    "shearon harris":          "Harris",
    "calvert cliffs 1":        "Calvert Cliffs",
    "calvert cliffs 2":        "Calvert Cliffs",
    "dc cook 1":               "Donald C. Cook",
    "dc cook 2":               "Donald C. Cook",
    "d.c. cook 1":             "Donald C. Cook",
    "d.c. cook 2":             "Donald C. Cook",
    "columbia generating":     "Columbia Generating",
    "wnp-2":                   "Columbia Generating",
    "wolf creek":              "Wolf Creek",
    "palo verde 1":            "Palo Verde",
    "palo verde 2":            "Palo Verde",
    "palo verde 3":            "Palo Verde",
    "south texas 1":           "South Texas Project",
    "south texas 2":           "South Texas Project",
    "comanche peak 1":         "Comanche Peak",
    "comanche peak 2":         "Comanche Peak",
    "r.e. ginna":              "R.E. Ginna",
    "ginna":                   "R.E. Ginna",
    "fitzpatrick":             "FitzPatrick",
    "j.a. fitzpatrick":        "FitzPatrick",
    "nine mile point 1":       "Nine Mile Point",
    "nine mile point 2":       "Nine Mile Point",
    "hope creek":              "Hope Creek",
    "salem 1":                 "Salem",
    "salem 2":                 "Salem",
    "surry 1":                 "Surry",
    "surry 2":                 "Surry",
    "north anna 1":            "North Anna",
    "north anna 2":            "North Anna",
    "millstone 2":             "Millstone",
    "millstone 3":             "Millstone",
    "point beach 1":           "Point Beach",
    "point beach 2":           "Point Beach",
    "monticello":              "Monticello",
    "prairie island 1":        "Prairie Island",
    "prairie island 2":        "Prairie Island",
    "grand gulf":              "Grand Gulf",
    "river bend":              "River Bend",
    "waterford 3":             "Waterford",
    "st. lucie 1":             "St. Lucie",
    "st. lucie 2":             "St. Lucie",
    "turkey point 3":          "Turkey Point",
    "turkey point 4":          "Turkey Point",
    "crystal river 3":         "Crystal River",
    "mcguire 1":               "McGuire",
    "mcguire 2":               "McGuire",
    "catawba 1":               "Catawba",
    "catawba 2":               "Catawba",
    "brunswick 1":             "Brunswick",
    "brunswick 2":             "Brunswick",
    "oconee 1":                "Oconee",
    "oconee 2":                "Oconee",
    "oconee 3":                "Oconee",
    "v.c. summer":             "V.C. Summer",
    "arkansas nuclear one 1":  "Arkansas Nuclear One",
    "arkansas nuclear one 2":  "Arkansas Nuclear One",
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


def get_today_rows(rows):
    if not rows:
        return []
    # Dates in NRC file are MM/DD/YYYY
    dates = []
    for r in rows:
        date_str = r.get("Date", "").strip()
        if date_str:
            try:
                dates.append(datetime.strptime(date_str, "%m/%d/%Y").date())
            except ValueError:
                pass
    if not dates:
        return []
    latest = max(dates)
    return [r for r in rows if r.get("Date", "").strip() and
            datetime.strptime(r["Date"].strip(), "%m/%d/%Y").date() == latest]


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
        today_rows = get_today_rows(all_rows)
        print(f"  Found {len(today_rows)} units for latest date")
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        supabase.table("sync_log").insert({
            "source": "nrc_daily_status", "status": "error",
            "error_message": str(e), "duration_ms": duration,
        }).execute()
        print(f"ERROR: {e}")
        raise SystemExit(1)

    unmatched = []
    updates   = 0
    now       = datetime.now(timezone.utc).isoformat()

    for row in today_rows:
        nrc_name = row.get("Plant", "").strip()
        nrc_unit = row.get("Unit", "").strip()
        power    = row.get("Power", "").strip()

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

        for reactor in targets:
            supabase.table("reactors").update({
                "daily_status": status_str,
                "daily_status_updated_at": now,
            }).eq("id", reactor["id"]).execute()
            updates += 1

    duration = int((time.time() - start) * 1000)
    supabase.table("sync_log").insert({
        "source":       "nrc_daily_status",
        "status":       "success",
        "rows_updated": updates,
        "duration_ms":  duration,
        "notes":        f"Unmatched: {len(unmatched)}. Names: {', '.join(unmatched[:10])}",
    }).execute()

    print(f"Done: {updates} reactors updated, {len(unmatched)} unmatched")
    if unmatched:
        print("  Unmatched plant names (add to NAME_MAP):")
        for u in unmatched:
            print(f"    {u}")


if __name__ == "__main__":
    main()
