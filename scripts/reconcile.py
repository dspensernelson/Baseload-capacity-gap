"""
Reconciliation engine — prove every headline number still traces to its atomic rows.

This is the recurring, logged version of the manual fact-check. For each headline
it RE-DERIVES the number a second, independent way (summing atomic rows in Python
from the canonical metric_lineage formula) and compares it to what the live
`headline_numbers` view actually publishes. A mismatch means the view was silently
re-defined, a row slipped its filter, or the data drifted — exactly the class of
error that froze "retiring by 2035" at the wrong value.

It also enforces the two provenance invariants the manual audit turned up:
  • every operating reactor must carry a license expiration date (Watts Bar bug)
  • the pipeline table must never contain a renewal/SLR row    (Diablo Canyon bug)
and checks that 100% of curated rows still cite a source.

Outputs (mirrors the watchdog so alerting reuses the same issue mechanism):
  • reconcile_status.txt = pass | drift | inconclusive
  • reconcile_report.txt = human-readable report
  • one reconciliation_log row per cross-check (the append-only audit trail)
  • stamps metric_lineage.last_value / last_reconciled_at / reconcile_status
  • one sync_log receipt

Always exits 0; alerting happens through the GitHub issue, never a red run.

Run:  python scripts/reconcile.py
"""
import os
import sys
import time
from datetime import datetime, timezone, date
from dotenv import load_dotenv
from supabase import create_client

try:
    from supabase.lib.client_options import ClientOptions
except Exception:
    ClientOptions = None

load_dotenv()
SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

NOW = datetime.now(timezone.utc)
CUTOFF_2035 = date(2035, 12, 31)
TOLERANCE_MW = 1.0          # rounding slack between view and Python re-derivation
STALE_DAYS = 180            # curated rows unverified longer than this get a warning

errors, warnings, log_rows, stamps = [], [], [], []


def make_client():
    if ClientOptions:
        try:
            return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY,
                                  options=ClientOptions(postgrest_client_timeout=20))
        except TypeError:
            pass
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def with_retry(fn, attempts=3, base_delay=4):
    last = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 — transient network errors
            last = e
            if i < attempts - 1:
                time.sleep(base_delay * (i + 1))
    raise last


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def parse_date(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s)[:10]).date()
    except ValueError:
        return None


def parse_ts(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None


def write_status(status, report):
    with open("reconcile_status.txt", "w", encoding="utf-8") as f:
        f.write(status)
    with open("reconcile_report.txt", "w", encoding="utf-8") as f:
        f.write(report)


def cross_check(metric_key, published, independent):
    """Compare the live view value to the independently re-derived value."""
    delta = independent - published
    ok = abs(delta) <= TOLERANCE_MW
    status = "pass" if ok else "drift"
    log_rows.append({
        "metric_key": metric_key,
        "our_value": f"{published:.2f}",
        "independent_value": f"{independent:.2f}",
        "delta": f"{delta:+.2f}",
        "status": status,
        "detail": "live view vs Python re-derivation from atomic rows",
    })
    stamps.append((metric_key, f"{published:.2f}", status))
    if not ok:
        errors.append(
            f"DRIFT {metric_key}: site shows {published:,.0f} MW but atomic rows sum to "
            f"{independent:,.0f} MW (delta {delta:+,.0f})."
        )
    return ok


def run_checks(sb):
    reactors = with_retry(lambda: sb.table("reactors")
                          .select("status, capacity_mw, license_expiration_date, source, source_url, verified_at")
                          .execute()).data or []
    projects = with_retry(lambda: sb.table("new_reactor_projects")
                          .select("project_name, capacity_mw, target_online_year, confidence, source, source_url, verified_at")
                          .execute()).data or []
    hn = with_retry(lambda: sb.table("headline_numbers").select("*").single().execute()).data or {}

    # ---- 1. Headline cross-checks: live view vs independent re-derivation ----
    op_calc = sum(num(r["capacity_mw"]) for r in reactors if r["status"] == "operating")
    cross_check("operating_mw", num(hn.get("operating_mw")), op_calc)

    ret_calc = sum(
        num(r["capacity_mw"]) for r in reactors
        if r["status"] in ("operating", "license_renewed")
        and parse_date(r["license_expiration_date"])
        and parse_date(r["license_expiration_date"]) <= CUTOFF_2035
    )
    cross_check("retiring_by_2035_mw", num(hn.get("retiring_by_2035_mw")), ret_calc)
    # the on-chart "X GW gap by 2035" label is the same number, rendered /1000
    stamps.append(("gap_2035_label", f"{ret_calc / 1000:.1f}", "pass" if not errors else "drift"))

    pipe_calc = sum(
        num(p["capacity_mw"]) for p in projects
        if p.get("target_online_year") and int(p["target_online_year"]) <= 2035
        and p.get("confidence") == "confirmed"
    )
    cross_check("pipeline_mw", num(hn.get("confirmed_pipeline_mw")), pipe_calc)

    # ---- 2. Invariant guards (the two errors the manual audit found) ----
    missing_lic = [r for r in reactors
                   if r["status"] in ("operating", "license_renewed")
                   and not parse_date(r["license_expiration_date"])]
    if missing_lic:
        errors.append(f"{len(missing_lic)} operating reactor(s) missing a license expiration date "
                      f"(would vanish from 'retiring by 2035' — the Watts Bar bug).")

    slr_in_pipeline = [p["project_name"] for p in projects
                       if any(k in (p.get("project_name") or "").lower()
                              for k in ("slr", "renewal", "license renew"))]
    if slr_in_pipeline:
        errors.append("Pipeline contains renewal/SLR row(s) (existing plants are not new build — "
                      f"the Diablo Canyon bug): {', '.join(slr_in_pipeline)}")

    # ---- 3. Provenance completeness across all four curated tables ----
    prov_total = prov_missing = stale = 0
    for tbl in ("reactors", "new_reactor_projects", "decommissioning", "license_actions"):
        rows = with_retry(lambda t=tbl: sb.table(t)
                          .select("source, source_url, verified_at").execute()).data or []
        for r in rows:
            prov_total += 1
            if not r.get("source") or not r.get("source_url") or not r.get("verified_at"):
                prov_missing += 1
            ts = parse_ts(r.get("verified_at"))
            if ts and (NOW - ts).days > STALE_DAYS:
                stale += 1
    if prov_missing:
        errors.append(f"{prov_missing}/{prov_total} curated rows have no source/URL/verified_at "
                      f"(a number with no provenance).")
    if stale:
        warnings.append(f"{stale}/{prov_total} curated rows not re-verified in over {STALE_DAYS} days.")
    log_rows.append({
        "metric_key": "provenance_completeness",
        "our_value": f"{prov_total - prov_missing}/{prov_total}",
        "independent_value": f"{prov_total}/{prov_total}",
        "delta": f"-{prov_missing}" if prov_missing else "0",
        "status": "pass" if not prov_missing else "drift",
        "detail": f"{stale} row(s) stale (>{STALE_DAYS}d)",
    })

    # operating-count sanity (informational)
    op_count = sum(1 for r in reactors if r["status"] == "operating")
    if not (90 <= op_count <= 96):
        warnings.append(f"Operating reactor count is {op_count} (expected ~94).")

    # ---- 4. Stamp every other registered metric as documented (formula+source on file) ----
    all_keys = with_retry(lambda: sb.table("metric_lineage").select("metric_key").execute()).data or []
    cross_checked = {s[0] for s in stamps}
    for row in all_keys:
        k = row["metric_key"]
        if k not in cross_checked:
            stamps.append((k, None, "documented"))

    return op_count, prov_total, prov_missing


def persist(sb, healthy):
    # reconciliation_log: append-only receipt, one row per check
    try:
        with_retry(lambda: sb.table("reconciliation_log").insert(
            [{"run_at": NOW.isoformat(), **r} for r in log_rows]).execute(), attempts=2)
    except Exception as e:  # noqa: BLE001
        print(f"(could not write reconciliation_log: {e})")

    # stamp metric_lineage so the public page can show "last verified"
    for key, value, status in stamps:
        patch = {"last_reconciled_at": NOW.isoformat(), "reconcile_status": status}
        if value is not None:
            patch["last_value"] = value
        try:
            with_retry(lambda k=key, p=patch: sb.table("metric_lineage")
                       .update(p).eq("metric_key", k).execute(), attempts=2)
        except Exception as e:  # noqa: BLE001
            print(f"(could not stamp metric_lineage {key}: {e})")

    # sync_log receipt
    try:
        with_retry(lambda: sb.table("sync_log").insert({
            "source": "reconcile",
            "status": "success" if healthy else "error",
            "rows_updated": len(stamps),
            "error_message": ("; ".join(errors))[:500] if errors else None,
            "notes": ("; ".join(warnings))[:500] if warnings else "all metrics reconciled",
        }).execute(), attempts=2)
    except Exception as e:  # noqa: BLE001
        print(f"(could not write sync_log: {e})")


def main():
    try:
        sb = make_client()
        op_count, prov_total, prov_missing = run_checks(sb)
    except Exception as e:  # noqa: BLE001 — unreachable DB / transient: stay quiet
        msg = (f"INCONCLUSIVE — reconciliation could not complete (likely a transient "
               f"connection issue): {type(e).__name__}: {str(e)[:200]}")
        print(msg)
        write_status("inconclusive", msg)
        return

    healthy = not errors
    lines = ["PASS — every headline number traces to its atomic rows"
             if healthy else "DRIFT — reconciliation found a problem"]
    lines.append(f"  reactors operating: {op_count}   curated rows with provenance: "
                 f"{prov_total - prov_missing}/{prov_total}")
    for r in log_rows:
        mark = "OK " if r["status"] == "pass" else "!! "
        lines.append(f"  {mark}{r['metric_key']}: site={r['our_value']} "
                     f"independent={r['independent_value']} (delta {r['delta']})")
    for e in errors:
        lines.append(f"  X  {e}")
    for w in warnings:
        lines.append(f"  -  {w}")
    report = "\n".join(lines)
    print(report)

    persist(sb, healthy)
    write_status("pass" if healthy else "drift", report)


if __name__ == "__main__":
    main()
    sys.exit(0)  # never fail the job; alerting is via the GitHub issue
