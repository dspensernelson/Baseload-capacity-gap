# ROADMAP — the long horizon

> **What this is:** a North Star, not a backlog. Specifics past ~18 months are illustrative —
> the value here is direction, the decisions worth making *now* so we don't foreclose later, and a
> plan for what will inevitably break. The map is not the territory; we'll redraw it often.
> Companion to [VISION.md](VISION.md) (the *why*) and CLAUDE.md / CHECKLIST.md (the *now*).
>
> Status (2026): the original vision is essentially built — six tabs, four self-updating data
> feeds, a watchdog, a year of history, an auto-written dispatch, and an interactive scenario
> explorer, all free and agent-maintained. This doc is about the decade *after* "feature-complete."

---

## 1. The thesis will evolve — and that's the plan

The site's argument has a deliberate arc. We let it mature instead of freezing it:

- **Phase A — "The Gap"** (now): capacity retiring vs. capacity replacing it.
- **Phase B — "The Race"**: reframe the gap against **demand growth** (data centers, electrification, onshoring). The question stops being "will we replace retirements?" and becomes "can firm clean capacity keep pace with load?"
- **Phase C — "The Scoreboard"**: a running tally of how the transition actually turns out — built vs. promised, on-time vs. slipped — reported honestly whichever way it breaks.

**Invariant:** the framing stays honest. Nuclear is the hero *via honest comparison*, never by hiding the hard parts. If the data ever turns against the thesis, the site reports that too. Credibility outranks cheerleading — it's the whole moat.

---

## 2. Four horizons

**H1 — Authority & reach** *(now → ~year 1)*
Become the *cited* source, not just a nice page. Embeddable charts/widgets, an open-data/API export, RSS + email, real SEO, dispatches that move from monthly → event-driven, the LLM content layer, and self-healing scrapers. **Win condition:** journalists, Wikipedia, and staffers cite it by name.

**H2 — Depth & breadth** *(year 1–3)*
Decades of historical data (not just the trailing year); **international** (IAEA PRIS — the global fleet, "meanwhile, the world"); the **demand side** (data-center & load-growth layer — the actual driver now); plant-level economics (cost, jobs, local tax base). The Race thesis gets its evidence.

**H3 — Personal & interactive** *(year 3–5)*
"Your grid" by zip/utility — what powers you, what's retiring near you, what it means for your rates and reliability. Alerts ("your local plant filed for renewal"). An embeddable scenario explorer. The model becomes a tool people *use*, not just read.

**H4 — Institution** *(year 5–10)*
A fully agent-run data-shop: open, peer-checkable methodology; the dataset as a public good; a durable (still ~$0) sustaining model; explicit governance and succession. The scenario engine matures into a credible public planning sandbox cited in real debates.

---

## 3. The tailwind: agents get better

Plan for an operation that becomes *more* autonomous over the decade. Today agents build features and draft content under human review; the trajectory is for the human role to shrink toward **taste, direction, and veto**. Architect for that: documents-as-management (CLAUDE.md/VISION.md as the standing instructions), everything reproducible, every action logged. We're riding a rising capability curve — don't build for today's agent ceiling.

---

## 4. Decide / do NOW because of the 10-year view

The only part of long-range planning that pays off immediately — choices that keep options open:

- **Never prune the history tape.** Decades of daily fleet behavior compound into the single most valuable, un-recreatable asset. Storage is free; deletion is irreversible.
- **Keep all editorial math in SQL views, and version the methodology.** Projections must stay reproducible and auditable years later.
- **Stand up a small open-data export early.** Cheap now; the "public good" posture is a moat and a distribution channel (H1).
- **Keep the stack portable and ~free.** No deep lock-in, no recurring cost that can kill it. Institutions that cost nothing don't die of funding.
- **Mature the watchdog → agent-fix loop.** Over a decade, NRC/EIA *will* change formats and APIs. The detection exists; the auto-repair (agent reads the break, opens a fix PR) is the durable investment.

---

## 5. Risks to plan against

| Risk | Plan |
|------|------|
| Source format / API changes (NRC, EIA) | Self-healing scrapers; the watchdog already detects, the agent-fix loop closes it |
| The thesis resolves or flips | Honest pivot (Gap → Race → Scoreboard); the framing invariant protects credibility |
| Credibility attack (an error, or the advocacy angle) | Every number survives a hostile fact-check; version + cite everything; admit the hard parts |
| Agent cost/capability shifts | Stay cheap and portable; ride the curve rather than betting on one vendor |
| Founder/maintainer fatigue | The whole point of agent-run: the institution must survive its operator losing interest |

---

## 6. What we will NOT do

- Commit to specific features past ~18 months (that's fiction, and it invites scope creep).
- Drift into "all of energy." Other sources appear only as context for the nuclear story.
- Trade credibility for reach — ever. The day a number doesn't survive a fact-check, the project is over regardless of traffic.

---

*Revisit this file when a horizon is reached or the thesis moves — not on a schedule. It should always read as "where we're pointed," never as a contract.*
