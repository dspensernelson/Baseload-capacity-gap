"""
pipeline_contract_check — fail if automation/traceability contract drifts.

Static checks only (no secrets, no database) so this can run in CI:
  1) Every expected automated script/workflow pair exists and workflow calls it.
  2) Every workflow-executed Python ETL script (except docs_check) includes sync_log usage.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
SCRIPTS = ROOT / "scripts"

errors = []
checks = 0

# Canonical automation mapping: a workflow is responsible for this script.
AUTOMATION_MAP = {
    "nrc-daily.yml": ["nrc_daily_status.py"],
    "nrc-license-weekly.yml": ["nrc_license_actions.py", "generate_radar.py"],
    "nrc-events.yml": ["nrc_event_notifications.py"],
    "eia930-generation.yml": ["eia930_generation.py"],
    "monthly-dispatch.yml": ["generate_dispatch.py"],
    "reconcile.yml": ["reconcile.py"],
    "health-check.yml": ["health_check.py"],
    "caiso-prices.yml": ["caiso_prices.py"],
    "nyiso-prices.yml": ["nyiso_prices.py"],
    "ercot-prices.yml": ["ercot_prices.py"],
    "pjm-prices.yml": ["pjm_prices.py"],
    "docs-check.yml": ["docs_check.py", "pipeline_contract_check.py"],
}


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def workflow_runs_script(workflow_text: str, script_name: str) -> bool:
    pattern = rf"python\s+scripts/{re.escape(script_name)}\b"
    return re.search(pattern, workflow_text) is not None


for wf_name, script_names in AUTOMATION_MAP.items():
    wf_path = WORKFLOWS / wf_name
    checks += 1
    if not wf_path.exists():
        errors.append(f"expected workflow `{wf_name}` is missing")
        continue

    wf_text = read(wf_path)
    for script_name in script_names:
        script_path = SCRIPTS / script_name
        checks += 1
        if not script_path.exists():
            errors.append(f"expected script `scripts/{script_name}` is missing")
            continue

        checks += 1
        if not workflow_runs_script(wf_text, script_name):
            errors.append(f"workflow `{wf_name}` does not run `scripts/{script_name}`")


# Traceability requirement: non-doc-check automation scripts must emit sync receipts.
workflow_paths = sorted(WORKFLOWS.glob("*.yml"))
for wf_path in workflow_paths:
    wf_text = read(wf_path)
    scripts_called = sorted(set(re.findall(r"python\s+scripts/([a-z0-9_]+\.py)\b", wf_text, flags=re.I)))
    for script_name in scripts_called:
        if script_name in {"docs_check.py", "pipeline_contract_check.py"}:
            continue
        script_path = SCRIPTS / script_name
        checks += 1
        if not script_path.exists():
            errors.append(f"workflow `{wf_path.name}` references missing `scripts/{script_name}`")
            continue
        script_text = read(script_path)
        checks += 1
        if "sync_log" not in script_text:
            errors.append(
                f"script `scripts/{script_name}` is workflow-automated but has no `sync_log` reference"
            )


print(f"pipeline_contract_check: ran {checks} checks across automation workflows/scripts")
if errors:
    print("CONTRACT DRIFT — automation/traceability contract no longer holds:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)

print("OK — automation contract holds")
sys.exit(0)
