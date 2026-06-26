# Next Session — paste this to start the next round

> **What this file is:** a copy-paste kickoff for whoever (human or agent) opens the *next*
> working thread on this project — so a fresh thread doesn't depend on finding the right
> chat history. Overwritten at the end of every round, same spirit as CLAUDE.md's
> "Current Session" footer, but action-oriented instead of a log. The log itself stays in
> CLAUDE.md and CHANGELOG.md — this file doesn't duplicate it, only points to it.

---

## Paste this to start

```
Continuing work on the Nuclear Pipeline Tracker ("NukeMap"). Long-running project —
don't ask me to re-explain it. Orient yourself first:

1. Read CLAUDE.md (working context, conventions, the "Current Session" footer for
   exactly what just shipped).
2. Read docs/INDEX.md, then follow it to docs/ARCHITECTURE.md and docs/decisions/
   for the *why* behind anything that looks like an odd choice.
3. Read docs/ROADMAP.md and docs/VISION.md (internal/gitignored, still present
   locally) for the thesis and the hidden-advocacy operating model. Don't relitigate.
4. Skim CHANGELOG.md for how we got to today.

Live site: https://nukemap-two.vercel.app — confirm git status is clean and local
main matches origin/main before assuming anything is unpushed.

This round's candidates (pick and confirm with me before building):

1. **Extend wholesale pricing further** — CAISO day-ahead + real-time and NYISO day-ahead +
   real-time are now live with no API key; PJM remains optional/key-gated. Next choices:
   ERCOT/SPP/MISO no-key endpoint hardening (if feasible) and/or deeper hub coverage.
   `wholesale_prices.iso`/`market` columns were built for exactly this, no schema change needed.
2. **H1 finishing pieces** (ROADMAP): event-driven Dispatches (not just monthly),
   self-healing scrapers (watchdog already detects breaks; the agent-fix loop is
   the open part). NOTE: an "LLM content layer" for Dispatches/Radar prose has been
   raised before and explicitly parked over Claude-spend concerns ("I don't want
   this taking my usage overnight" — see CLAUDE.md history). Don't build LLM-written
   autonomous content without re-confirming that's now wanted.
3. **H2 depth** (ROADMAP): an international panel (IAEA PRIS — "meanwhile, the
   world"), or plant-level economics (cost, jobs, local tax base).
4. **Newsletter** — parked last round on subscriber-demand skepticism, not because
   it's infeasible (RSS already exists as the backbone). Revisit only if a sharper
   angle than "subscribe to the Dispatch" comes up.

Use TaskCreate/TaskUpdate to track work, follow CLAUDE.md's conventions (SQL views
for math, provenance on every curated row + metric_lineage entry for every public
number, docs_check.py before committing doc/schema changes, verify in preview
before shipping), and ask before any commit/push.

Before you finish this round: update CLAUDE.md's Current Session footer AND this
file (docs/NEXT_SESSION.md) with what actually shipped and what's left, the same
way this round's thread did it for you.
```

---

## Why this file exists

Two threads worked this project back to back: one scoped a documentation overhaul so
the repo could be picked up cold; the very next one used that orientation, then shipped
distribution + the Regulatory Radar + a demand-growth visual (shipped, then relocated
same-day on feedback) + a CAISO wholesale-pricing pilot — entirely from `CLAUDE.md` +
`docs/INDEX.md`, no chat continuity required. This file is that handoff, made a durable
habit instead of a one-off prompt.
