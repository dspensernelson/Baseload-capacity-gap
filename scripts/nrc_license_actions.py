"""
Scrapes the NRC license renewal status pages and rebuilds the license_actions
table from source, so license data never needs manual verification.

Sources:
  - Subsequent license renewal (60->80 yr): applications under review + issued
  - Initial license renewal (40->60 yr): applications under review + issued history

For issued renewals it also updates reactors.license_expiration_date to the
authoritative post-renewal date, which feeds headline_numbers and gap_series.

Every run writes one row to sync_log.
"""
import os
import re
import time
import difflib
import requests
from datetime import date, datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

SLR_URL = "https://www.nrc.gov/reactors/operating/licensing/renewal/subsequent-license-renewal.html"
LR_URL  = "https://www.nrc.gov/reactors/operating/licensing/renewal/applications.html"

# action_types this script owns; rows of other types (e.g. restart_authorization)
# are preserved across rebuilds
OWNED_ACTION_TYPES = ["license_renewal", "subsequent_license_renewal"]

# Normalized NRC plant names -> exact reactors.plant_name. The NRC renewal pages
# use long-form names; normalize() strips dots and common suffixes first.
NAME_MAP = {
    "arkansas nuclear one":  "Arkansas Nuclear One",
    "arkansas nuclear":      "Arkansas Nuclear One",
    "braidwood":             "Braidwood Generation Station",
    "browns ferry":          "Browns Ferry",
    "brunswick":             "Brunswick Nuclear",
    "byron":                 "Byron Generating Station",
    "calvert cliffs":        "Calvert Cliffs Nuclear Power Plant",
    "clinton":               "Clinton Power Station",
    "columbia":              "Columbia Generating Station",
    "cooper":                "Cooper Nuclear Station",
    "davis-besse":           "Davis Besse",
    "davis besse":           "Davis Besse",
    "dc cook":               "Donald C Cook",
    "donald c cook":         "Donald C Cook",
    "dresden":               "Dresden Generating Station",
    "edwin i hatch":         "Edwin I Hatch",
    "hatch":                 "Edwin I Hatch",
    "farley":                "Joseph M Farley",
    "joseph m farley":       "Joseph M Farley",
    "fitzpatrick":           "James A Fitzpatrick",
    "james a fitzpatrick":   "James A Fitzpatrick",
    "ginna":                 "R E Ginna Nuclear Power Plant",
    "re ginna":              "R E Ginna Nuclear Power Plant",
    "hb robinson":           "H B Robinson",
    "robinson":              "H B Robinson",
    "hope creek":            "PSEG Hope Creek Generating Station",
    "lasalle":               "LaSalle Generating Station",
    "monticello":            "Monticello Nuclear Facility",
    "nine mile point":       "Nine Mile Point Nuclear Station",
    "point beach":           "Point Beach Nuclear Plant",
    "quad cities":           "Quad Cities Generating Station",
    "salem":                 "PSEG Salem Generating Station",
    "shearon harris":        "Harris (NC)",
    "harris":                "Harris (NC)",
    "south texas":           "South Texas Project",
    "st lucie":              "St Lucie",
    "summer":                "V C Summer",
    "vc summer":             "V C Summer",
    "virgil c summer":       "V C Summer",
    "susquehanna":           "TalenEnergy Susquehanna",
    "vogtle":                "Vogtle",
    "waterford":             "Waterford 3",
    "watts bar":             "Watts Bar Nuclear Plant",
    "wolf creek":            "Wolf Creek Generating Station",
}

STRIP_SUFFIXES = [
    " nuclear power plant", " nuclear power station", " nuclear generating station",
    " nuclear generating plant", " steam electric plant", " electric generating plant",
    " nuclear plant", " nuclear station", " nuclear facility", " power station",
    " generating station", " power plant", " nuclear", " station", " plant",
]


def normalize(name: str) -> str:
    n = name.lower().replace(".", "").strip()
    changed = True
    while changed:
        changed = False
        for suffix in STRIP_SUFFIXES:
            if n.endswith(suffix):
                n = n[: -len(suffix)].strip()
                changed = True
    return n


def clean_cell(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    text = (text.replace("&nbsp;", " ").replace("&amp;", "&")
                .replace("–", " ").replace("—", " ").replace("’", "'"))
    return re.sub(r"\s+", " ", text).strip()


def fetch_tables(url: str) -> list[list[list[str]]]:
    resp = requests.get(url, timeout=60, headers={"User-Agent": "nuclear-pipeline-tracker"})
    resp.raise_for_status()
    tables = []
    for tbl in re.findall(r"(?s)<table.*?</table>", resp.text):
        rows = []
        for tr in re.findall(r"(?s)<tr.*?</tr>", tbl):
            cells = [clean_cell(c) for c in re.findall(r"(?s)<t[dh][^>]*>(.*?)</t[dh]>", tr)]
            if cells:
                rows.append(cells)
        tables.append(rows)
    return tables


DATE_RE = re.compile(r"\d{1,2}/\d{1,2}/\d{2,4}")


def parse_date(s: str) -> date | None:
    m = DATE_RE.search(s or "")
    if not m:
        return None
    raw = m.group(0)
    fmt = "%m/%d/%Y" if len(raw.split("/")[-1]) == 4 else "%m/%d/%y"
    try:
        return datetime.strptime(raw, fmt).date()
    except ValueError:
        return None


def parse_plant_cell(cell: str) -> tuple[str, list[str]]:
    """'Browns Ferry Nuclear Plant, Units 1, 2, 3' -> ('Browns Ferry Nuclear Plant', ['1','2','3'])"""
    units = re.findall(r"\b([1-4])\b", cell)
    name = re.split(r",| unit| units|\b[1-4]\b", cell, flags=re.IGNORECASE)[0]
    return name.strip(" ,&"), units


def parse_expiration_cell(cell: str, units: list[str], issued: date | None) -> dict[str, date]:
    """Map unit -> final license expiration.

    The NRC column mixes 'date entering (subsequent) period of extended operation'
    (the OLD expiration; final = +20 years) with already-final expirations. If the
    date is more than 25 years past issuance it is already final; otherwise add 20.
    """
    labeled = re.findall(r"(\d{1,2}/\d{1,2}/\d{2,4})\s*\(\s*Unit\s*([1-4])\s*\)", cell)
    pairs = []
    if labeled:
        pairs = [(u, parse_date(d)) for d, u in labeled]
    else:
        d = parse_date(cell)
        if d:
            pairs = [(u, d) for u in (units or [""])]

    out = {}
    for unit, d in pairs:
        if not d:
            continue
        if issued and (d.year - issued.year) <= 25:
            d = d.replace(year=d.year + 20)
        out[unit] = d
    return out


def match_plant(nrc_name: str, plant_names: list[str]) -> str | None:
    key = normalize(nrc_name)
    if key in NAME_MAP:
        return NAME_MAP[key]
    norm_names = {normalize(n): n for n in plant_names}
    if key in norm_names:
        return norm_names[key]
    # High cutoff on purpose: the issued-history table includes shutdown plants
    # (Indian Point, Oyster Creek, ...) that must NOT fuzzy-match an operating
    # plant; anything legitimate but oddly named belongs in NAME_MAP instead
    matches = difflib.get_close_matches(key, norm_names.keys(), n=1, cutoff=0.75)
    return norm_names[matches[0]] if matches else None


def build_actions(slr_tables, lr_tables, db_reactors):
    """Returns (rows for license_actions, unmatched plant names)."""
    plant_names = list({r["plant_name"] for r in db_reactors})
    actions, unmatched = [], []

    def db_units(plant, units):
        cands = [r for r in db_reactors if r["plant_name"] == plant]
        if units:
            by_unit = [r for r in cands if r["unit_number"] in units]
            if by_unit:
                return by_unit
        return cands

    def add(table, action_type, status, received_col, issued_col, exp_col):
        for row in table[1:]:  # skip header row
            if len(row) <= max(received_col, issued_col or 0, exp_col or 0):
                continue
            if "no applications" in row[0].lower():
                continue
            plant_raw, units = parse_plant_cell(row[0])
            plant = match_plant(plant_raw, plant_names)
            if not plant:
                unmatched.append(plant_raw)
                continue
            received = parse_date(row[received_col])
            issued = parse_date(row[issued_col]) if issued_col is not None else None
            exp_by_unit = (parse_expiration_cell(row[exp_col], units, issued)
                           if exp_col is not None else {})
            for r in db_units(plant, units):
                exp = exp_by_unit.get(r["unit_number"]) or (
                    list(exp_by_unit.values())[0] if len(exp_by_unit) == 1 else None)
                actions.append({
                    "reactor_id":          r["id"],
                    "action_type":         action_type,
                    "action_date":         (issued or received).isoformat() if (issued or received) else None,
                    "new_expiration_date": exp.isoformat() if exp else None,
                    "status":              status,
                    "notes":               f"{plant} Unit {r['unit_number']} — scraped from nrc.gov"
                                           + (f"; application received {received}" if received else ""),
                })

    # SLR page: table 2 = under review, table 3 = issued
    if len(slr_tables) >= 3:
        add(slr_tables[1], "subsequent_license_renewal", "under_review", 1, None, None)
        add(slr_tables[2], "subsequent_license_renewal", "approved", 1, 2, 3)

    # Initial LR page: tables 2 & 3 = in review pipeline, table 4 = issued history
    if len(lr_tables) >= 4:
        add(lr_tables[1], "license_renewal", "under_review", 1, None, None)
        add(lr_tables[2], "license_renewal", "under_review", 1, None, None)
        add(lr_tables[3], "license_renewal", "approved", 1, 2, 3)

    return actions, unmatched


def main():
    start = time.time()
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    result = supabase.table("reactors").select(
        "id, plant_name, unit_number, license_expiration_date").execute()
    db_reactors = result.data

    print("Fetching NRC license renewal pages…")
    try:
        slr_tables = fetch_tables(SLR_URL)
        lr_tables = fetch_tables(LR_URL)
        actions, unmatched = build_actions(slr_tables, lr_tables, db_reactors)
        print(f"  Parsed {len(actions)} actions, {len(unmatched)} unmatched plants")
    except Exception as e:
        supabase.table("sync_log").insert({
            "source": "nrc_license_actions", "status": "error",
            "error_message": str(e),
            "duration_ms": int((time.time() - start) * 1000),
        }).execute()
        print(f"ERROR: {e}")
        raise SystemExit(1)

    # Full rebuild of the action types this script owns
    supabase.table("license_actions").delete().in_("action_type", OWNED_ACTION_TYPES).execute()
    if actions:
        supabase.table("license_actions").insert(actions).execute()

    # Issued renewals carry the authoritative current expiration; push the latest
    # per reactor into reactors.license_expiration_date
    latest_exp = {}
    for a in actions:
        if a["status"] == "approved" and a["new_expiration_date"]:
            cur = latest_exp.get(a["reactor_id"])
            if not cur or a["new_expiration_date"] > cur:
                latest_exp[a["reactor_id"]] = a["new_expiration_date"]

    now = datetime.now(timezone.utc).isoformat()
    exp_updates = 0
    for r in db_reactors:
        new_exp = latest_exp.get(r["id"])
        if new_exp and new_exp != r["license_expiration_date"]:
            supabase.table("reactors").update({
                "license_expiration_date": new_exp,
                "updated_at": now,
            }).eq("id", r["id"]).execute()
            exp_updates += 1

    supabase.table("sync_log").insert({
        "source":        "nrc_license_actions",
        "status":        "success",
        "rows_inserted": len(actions),
        "rows_updated":  exp_updates,
        "duration_ms":   int((time.time() - start) * 1000),
        "notes":         f"Unmatched: {len(unmatched)}. Names: {', '.join(sorted(set(unmatched))[:15])}",
    }).execute()

    print(f"Done: {len(actions)} license actions written, "
          f"{exp_updates} reactor expirations updated, {len(unmatched)} unmatched")
    if unmatched:
        print("  Unmatched (mostly shutdown plants not in reactors table):")
        for u in sorted(set(unmatched)):
            print(f"    {u}")


if __name__ == "__main__":
    main()
