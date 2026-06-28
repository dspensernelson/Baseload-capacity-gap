# Documentation Index

Every document, who it's for, and the rule that keeps it true. Three readers:
**🤖 the agent** that runs/extends this cold · **🧭 the operator** (you, or a successor) ·
**🏛️ the public** (journalist, skeptic, future historian).

## Start here

| If you want to… | Read |
|---|---|
| Understand what this is | [`README.md`](../README.md) 🏛️ |
| Rebuild it from nothing | [`REBUILD.md`](REBUILD.md) 🧭🤖 |
| Understand how it fits together | [`ARCHITECTURE.md`](ARCHITECTURE.md) 🤖🧭 |
| Find a table or column | [`data-model.md`](data-model.md) 🤖 |
| Know where a number came from | [`/sources`](https://baseload-capacity-gap.vercel.app/sources) + [`PROVENANCE.md`](PROVENANCE.md) + [`SOURCES.md`](SOURCES.md) 🏛️🤖 |
| Understand *why* a choice was made | [`decisions/`](decisions/) (ADRs) 🤖🧭 |
| Know where it's headed | [`ROADMAP.md`](ROADMAP.md) · `VISION.md` (internal) 🧭 |
| Operate / verify the live system | [`VERIFY.md`](../VERIFY.md) · [`TESTING.md`](../TESTING.md) 🧭 |
| Work on the code as an agent | [`CLAUDE.md`](../CLAUDE.md) 🤖 |
| Start the *next* working session | [`NEXT_SESSION.md`](NEXT_SESSION.md) 🤖🧭 |
| See how it evolved | [`CHANGELOG.md`](../CHANGELOG.md) 🏛️ |

## Full map

**Current (keep these true):** README · ARCHITECTURE · data-model · REBUILD · PROVENANCE ·
SOURCES · ROADMAP · decisions/ · CLAUDE.md · NEXT_SESSION · VERIFY · TESTING · CHANGELOG · methodology.md.

**Internal (gitignored, local only):** `VISION.md` — the full positioning, including the
parts never printed on the site. The public docs describe the reference work; VISION holds
the strategy behind it.

**Historical (🏺 period artifacts, do not follow as current):** `agent-runbook.md` and
`session-01..08.md` — the original V1 manual build log. Superseded by ARCHITECTURE + REBUILD.

## The freshness contract

Docs rot silently — so we make drift *fail*, the same way we make wrong numbers fail.
`scripts/docs_check.py` (CI) enforces the mechanical parts; the rest is discipline:

| When you… | Update… |
|---|---|
| add/change a table | `data-model.md` **and** add a `supabase/*.sql` artifact (docs_check enforces) |
| add/remove a cron | the cron table in `README.md` (docs_check enforces) |
| add/rename a tab | `README.md` tab list + the tab-theory note in `CLAUDE.md`/ADR-0005 |
| change a view's formula | that number's `metric_lineage` row (same commit) — ADR-0002/0006 |
| make a notable decision | a new file in `decisions/` |
| move the thesis | `VISION.md` and `ROADMAP.md` |
| ship anything notable | a line in `CHANGELOG.md` |
| finish a working session | refresh `CLAUDE.md`'s Current Session footer **and** `docs/NEXT_SESSION.md` (the next thread's kickoff) |

Run `python scripts/docs_check.py` before committing docs or schema changes.
