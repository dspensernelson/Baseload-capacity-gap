"""
Generate the weekly "Regulatory Radar" digest — a plain-English summary of what
changed in NRC license actions since last week.

license_actions is fully rebuilt from nrc.gov on every run of
nrc_license_actions.py (delete + reinsert of the owned action types), so the
table itself carries no row-level history to diff against. Instead this script
snapshots the current (reactor, action_type) -> status state into reports.stats
(kind='weekly_radar') and diffs it against the previous week's stored snapshot.

Published to the `reports` table, rendered on /dispatches alongside the
always-live pending/issued list (which shows current state; this shows change).

Run:  python scripts/generate_radar.py
"""
import os
import time
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

NOW = datetime.now(timezone.utc)

ACTION_LABELS = {
    "license_renewal": "license renewal",
    "subsequent_license_renewal": "80-year extension (SLR)",
    "restart_authorization": "restart authorization",
}


def main():
    start = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    reactors = sb.table("reactors").select("id, plant_name, unit_number").execute().data
    name_of = {r["id"]: f"{r['plant_name']} Unit {r['unit_number']}" for r in reactors}

    actions = sb.table("license_actions").select(
        "reactor_id, action_type, status, new_expiration_date").execute().data

    # Keyed by (reactor, action_type) — stable across full-table rebuilds, unlike row id.
    current = {}
    for a in actions:
        if not a.get("reactor_id"):
            continue
        key = f"{a['reactor_id']}:{a['action_type']}"
        current[key] = {
            "status": a["status"],
            "new_expiration_date": a.get("new_expiration_date"),
            "name": name_of.get(a["reactor_id"], "Unknown reactor"),
            "label": ACTION_LABELS.get(a["action_type"], a["action_type"]),
        }

    prev = (sb.table("reports").select("stats")
            .eq("kind", "weekly_radar").order("published_at", desc=True)
            .limit(1).execute().data)
    previous = (prev[0]["stats"] or {}).get("snapshot") if prev else None

    changes = []
    if previous is None:
        under_review = sum(1 for v in current.values() if v["status"] == "under_review")
        approved = sum(1 for v in current.values() if v["status"] == "approved")
        changes.append(
            f"Baseline check: {under_review} license action(s) currently under NRC review, "
            f"{approved} approved on record. Future weeks will report what changes."
        )
    else:
        for key, v in current.items():
            prev_v = previous.get(key)
            if prev_v is None and v["status"] == "under_review":
                changes.append(f"{v['name']}'s {v['label']} is now under NRC review.")
            elif prev_v and prev_v.get("status") == "under_review" and v["status"] == "approved":
                exp = v.get("new_expiration_date")
                tail = f", extending its license to {exp[:4]}" if exp else ""
                changes.append(f"{v['name']}'s {v['label']} was approved{tail}.")
        if not changes:
            changes.append("No NRC license-action changes recorded this week.")

    period = NOW.strftime("%Y-W%V")
    title = f"Regulatory Radar — week of {NOW:%B} {NOW.day}, {NOW.year}"
    body = "\n".join(changes)

    sb.table("reports").upsert(
        {"kind": "weekly_radar", "period": period, "title": title, "body": body,
         "stats": {"snapshot": current}, "published_at": NOW.isoformat()},
        on_conflict="kind,period",
    ).execute()

    sb.table("sync_log").insert({
        "source":        "generate_radar",
        "status":        "success",
        "rows_inserted": len(changes),
        "duration_ms":   int((time.time() - start) * 1000),
        "notes":         title,
    }).execute()

    print(f"Published: {title}\n{body}")


if __name__ == "__main__":
    main()
