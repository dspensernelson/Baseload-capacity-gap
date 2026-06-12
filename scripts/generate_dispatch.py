"""
Generate the monthly "Dispatch" — a plain-English state-of-the-fleet report,
written from the data the crons already collect and published to the `reports`
table (which the site renders). Deterministic templating for now; an LLM can
replace the prose layer later without changing the plumbing.

Each dispatch stores its headline stats in `reports.stats`, so the next one can
diff against it — turning this into a real "what changed since last month" engine.

Run:  python scripts/generate_dispatch.py
"""
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

NOW = datetime.now(timezone.utc)


def gw(mw):
    return round(float(mw) / 1000, 1) if mw not in (None, "") else 0.0


def delta_phrase(curr, prev, unit="GW", up_is="", down_is=""):
    if prev is None:
        return ""
    d = round(curr - prev, 1)
    if abs(d) < 0.05:
        return " (unchanged from last month)"
    arrow = "▲" if d > 0 else "▼"
    return f" ({arrow} {abs(d)} {unit} vs last month)"


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    hn = sb.table("headline_numbers").select("*").single().execute().data
    operating = gw(hn.get("operating_mw"))
    retiring  = gw(hn.get("retiring_by_2035_mw"))
    pipeline  = gw(hn.get("confirmed_pipeline_mw"))

    series = sb.table("fleet_output_series").select("*").order("report_date").execute().data
    last30 = series[-30:] if len(series) >= 30 else series
    prev30 = series[-60:-30] if len(series) >= 60 else []
    def avg_gw(rows):
        return round(sum(float(r["output_mw"]) for r in rows) / len(rows) / 1000, 1) if rows else 0.0
    avg30      = avg_gw(last30)
    avg_prev30 = avg_gw(prev30) if prev30 else None
    max_offline = max((int(r.get("units_offline") or 0) for r in last30), default=0)
    cap_gw = gw(max((float(r["capacity_mw"]) for r in series), default=0) if series else 0)
    cf = round(avg30 / cap_gw * 100) if cap_gw else 0

    reactors = sb.table("reactors").select("status").execute().data
    n_operating = sum(1 for r in reactors if r["status"] in ("operating", "license_renewed"))

    acts = sb.table("license_actions").select("status, action_type").execute().data
    under_review = sum(1 for a in acts if a.get("status") == "under_review")
    approved     = sum(1 for a in acts if a.get("status") == "approved")
    slr_approved = sum(1 for a in acts if a.get("status") == "approved" and a.get("action_type") == "subsequent_license_renewal")

    # Diff against the previous dispatch, if any
    prev = (sb.table("reports").select("stats, period")
            .order("published_at", desc=True).limit(1).execute().data)
    pstats = prev[0]["stats"] if prev else None
    p = (lambda k: pstats.get(k) if pstats else None)

    period = NOW.strftime("%Y-%m")
    month  = NOW.strftime("%B %Y")
    title  = f"U.S. Nuclear — {month} Dispatch"

    body = f"""## The fleet right now

As of {NOW:%B} {NOW.day}, {NOW.year}, the U.S. operating fleet stands at **{n_operating} reactors**, about **{operating} GW**{delta_phrase(operating, p('operating_gw'))}. Over the last 30 days it generated an average of **{avg30} GW** — roughly **{cf}% of capacity** — with up to **{max_offline} units** offline for scheduled refueling at once. Nuclear doesn't make headlines on a normal day, and that's the point: it ran near full output, every hour, all month.

## The license front

**{retiring} GW** of capacity carries an NRC operating license expiring by 2035{delta_phrase(retiring, p('retiring_gw'))} — the gap the rest of the grid has to cover or the NRC has to extend. To date the NRC has approved **{approved} renewal actions** ({slr_approved} of them 80-year extensions), and **{under_review} applications** are currently under review. Every approval pushes a retirement date later and quietly shrinks that gap.

## The build pipeline

**{pipeline} GW** of new nuclear sits in the confirmed pipeline{delta_phrase(pipeline, p('pipeline_gw'))} — the capacity racing to arrive before the retirements land.

---

_Auto-generated from NRC daily power-status reports and license records on {NOW:%Y-%m-%d}. The figures above update continuously on the tracker; this dispatch is a monthly snapshot._
"""

    stats = {
        "operating_gw": operating, "retiring_gw": retiring, "pipeline_gw": pipeline,
        "avg30_gw": avg30, "capacity_factor_pct": cf, "max_units_offline": max_offline,
        "under_review": under_review, "approved": approved, "n_operating": n_operating,
    }

    sb.table("reports").upsert(
        {"kind": "monthly", "period": period, "title": title, "body": body, "stats": stats,
         "published_at": NOW.isoformat()},
        on_conflict="kind,period",
    ).execute()

    print(f"Published dispatch: {title}\n")
    print(body)


if __name__ == "__main__":
    main()
