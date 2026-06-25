# Architecture Decision Records (ADRs)

Short records of the decisions that shaped this project — the *why*, so a future
maintainer (human or agent) understands the reasoning, not just the result.

Each ADR: **Context** (the forces) → **Decision** → **Consequences**. Status is Accepted
unless noted. Numbers are assigned once and never reused.

| # | Decision |
|---|----------|
| [0001](0001-maplibre-over-mapbox.md) | MapLibre over Mapbox |
| [0002](0002-editorial-math-in-sql-views.md) | Editorial math lives in SQL views |
| [0003](0003-free-portable-stack.md) | A free, portable stack |
| [0004](0004-editorial-stance.md) | Editorial stance: show, don't tell |
| [0005](0005-tab-theory.md) | Tab theory: one tab per visitor question |
| [0006](0006-provenance-system.md) | Provenance & reconciliation |
| [0007](0007-incidents-facility-filter.md) | Incidents: plant events only |
| [0008](0008-pipeline-arriving-only.md) | Pipeline = capacity arriving only |
| [0009](0009-anon-key-frontend.md) | Anon key on the frontend |
| [0010](0010-automation-ratchet.md) | The automation ratchet |
| [0011](0011-gap-formula.md) | The gap formula & nameplate vs net |
| [0012](0012-thin-distribution-functions.md) | Thin read-only Vercel functions for distribution |

## Writing a new one
Copy the shape of any file here and add a row above. If a decision touches the *advocacy
strategy*, keep that part in `docs/VISION.md` (internal) — the public ADRs describe the
reference work, not the persuasion behind it.
