"""
docs_check — fail if the documentation has drifted from the code.

The provenance discipline, applied to the docs. Pure static checks over the repo
(no database, no secrets) so it runs anywhere — CI, your laptop, an archaeologist's.
Wire into CI (.github/workflows/docs-check.yml) or run before committing doc/schema work:

    python scripts/docs_check.py

Checks:
  1. Every table created in supabase/*.sql is documented in docs/data-model.md.
  2. Every table documented in docs/data-model.md has a CREATE TABLE artifact.
  3. Every GitHub Actions workflow is mentioned in README.md.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []
checks = 0


def read(rel):
    p = ROOT / rel
    return p.read_text(encoding="utf-8") if p.exists() else ""


data_model = read("docs/data-model.md")
readme = read("README.md")

sql_text = "\n".join(p.read_text(encoding="utf-8") for p in sorted((ROOT / "supabase").glob("*.sql")))
sql_tables = sorted(set(re.findall(
    r'CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([a-z_]+)', sql_text, re.I)))
doc_tables = sorted(set(re.findall(r'^###\s+`([a-z_]+)`', data_model, re.M)))

# 1 — SQL tables ⊆ documented
for t in sql_tables:
    checks += 1
    if f"`{t}`" not in data_model:
        errors.append(f"table `{t}` is created in supabase/*.sql but not documented in docs/data-model.md")

# 2 — documented tables ⊆ SQL artifacts (catches a table doc with no rebuildable DDL)
for t in doc_tables:
    checks += 1
    if t not in sql_tables:
        errors.append(f"table `{t}` is documented in data-model.md but has no CREATE TABLE in supabase/*.sql")

# 3 — every workflow is mentioned in the README
for wf in sorted((ROOT / ".github" / "workflows").glob("*.yml")):
    checks += 1
    if wf.name not in readme:
        errors.append(f"workflow {wf.name} is not mentioned in README.md")

print(f"docs_check: ran {checks} checks across {len(sql_tables)} tables + workflows")
if errors:
    print("DRIFT — docs no longer match the code:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
print("OK — docs match the code")
sys.exit(0)
