# VISION — The Nuclear Pipeline Tracker

> **The one-sentence vision:** Become the place the curious public, journalists, and energy-literate professionals go to understand the American nuclear transition — every reactor, every megawatt, every regulatory action, rendered with the editorial clarity of a great newspaper graphic and the freshness of a live terminal.

This document is the long-term map. V1 shipped the thesis. Everything below is about turning a chart into an institution.

---

## 1. Why this can win

There is no good public home for this story. The data exists — NRC publishes daily power levels, license actions, and dockets; EIA publishes inventories and hourly generation — but it lives in pipe-delimited text files, ArcGIS portals, and PDF-shaped HTML from 2009. The people who can read those sources don't need us. Everyone else gets their picture of nuclear power from twenty-year-old vibes.

Meanwhile the actual story is turning over faster than at any point since the 1970s:

- **The restart era is real.** Palisades became the first shutdown US reactor ever returned to service. TMI-1 and Duane Arnold are behind it, bought back to life by data-center demand.
- **The 80-year fleet is forming.** Subsequent license renewals are being approved in waves — our own scraper watched the "retiring by 2035" number fall from 18.5 GW to 12.0 GW the day it first ran, because NRC had approved extensions faster than any hand-curated source tracked them.
- **Demand stopped being flat.** AI data centers, electrification, and onshoring broke the 20-year-flat-load assumption that justified every retirement of the 2010s.
- **New build is plural again.** Vogtle finished. AP1000s are being discussed seriously. SMR dockets are live at NRC.

Our structural advantages, already built:

1. **Automation moat.** Two crons keep the database honest with zero human verification — daily power status (92/94 units) and monthly license actions scraped from nrc.gov itself. Most "nuclear trackers" are a grad student's spreadsheet that died when they graduated. Ours updates while we sleep.
2. **Editorial spine.** One thesis — *the gap between what's retiring and what's replacing it* — expressed in one chart. We are not a dashboard with forty toggles. We are an argument with evidence.
3. **Free stack.** Supabase + Vercel + GitHub Actions + MapLibre = $0/month. We can run for years on conviction alone. Institutions that cost nothing don't die of fatigue.

---

## 2. The thesis grows up

V1's thesis: **"There is a gap."** Capacity is retiring faster than it's being replaced.

That thesis has a shelf life — and that's good. The SLR wave is closing the *license* gap; the demand wave is opening an *energy* gap. The mature thesis, which the site should grow into:

> **"This is what it takes to keep the lights on without carbon — and here is exactly where we stand, today, reactor by reactor."**

Three evolutions of the story, in order:

| Era | Question the site answers | Hero artifact |
|---|---|---|
| **V1 — The Gap** (now) | What retires vs. what replaces it? | The gap chart |
| **V2 — The Race** | Is the buildout keeping pace with demand growth? | Demand line overlaid on the gap; restarts and uprates as "rescued capacity" |
| **V3 — The Transition** | What does the US grid's firm-clean backbone look like through 2050? | Scenario explorer — the user moves the levers |

The framing rule from CLAUDE.md survives every era: **nuclear is the hero, never the victim and never the combatant.** We don't dunk on wind and solar. We use them as *context* — because honest comparison is the most persuasive thing we can publish.

---

## 3. Other energy systems: context, not combat

The single most misleading unit in energy journalism is the gigawatt. The hub's job is to make capacity vs. energy intuitive without a single equation on screen. Other sources enter the site as **measuring sticks**, not opponents.

### 3.1 The "What is a reactor, really?" module

Every reactor detail page eventually answers: *what would it take to replace this machine?* Not rhetorically — arithmetically, from live data:

- A 1,100 MW unit at the fleet's ~93% capacity factor produces ~9 TWh/yr.
- Replacing those *terawatt-hours* takes roughly 2.5–3 GW of wind or 5–6 GW of solar-plus-storage — built new, on new land, with new transmission. (Exact figures computed from current EIA capacity-factor data, not hardcoded.)
- That's not an argument against building wind and solar. It's the honest exchange rate. Readers can do whatever they want with an honest exchange rate.

### 3.2 The 2 A.M. test

With EIA-930 hourly data (V2 parking lot, promoted): a live strip showing **what is generating right now** on the US grid, by source. Nuclear's flat line across the night — while solar sleeps and wind wanders — is the single most persuasive image in energy. We don't have to say anything. We just have to show 2 a.m., every day, forever.

### 3.3 The context layer, on the map

The map gains optional layers that place nuclear inside the wider system rather than apart from it:

- **Wind/solar utility-scale sites** (EIA-860) — sized by capacity, *and by expected annual energy*, toggleable. The visual difference between those two togglings is itself the lesson.
- **Interconnection queues** (LBNL/ISO data) — the thousand-plus GW of mostly-solar waiting in line. Context: the grid's bottleneck isn't ambition, it's plumbing.
- **Retired coal sites** — the natural real estate of the SMR era (existing switchyards, water, workforce). Where the next reactors plausibly go.

### 3.4 The honesty ledger

A standing methodology page that states plainly where nuclear is *not* winning: construction cost overruns, Vogtle's timeline, the unsolved waste-siting politics (note: solved engineering, unsolved politics — say both). Credibility is the product. An advocacy site that admits the hard parts is the only kind anyone cites twice.

---

## 4. From page to hub: the five surfaces

A hub is a place you *return* to. One page, however good, is a poster. These five surfaces give people reasons to come back, in rough build order:

### Surface 1 — The Live Page (exists, keeps sharpening)
The current site: gap banner → headline numbers → map + table. It stays the front door. Additions over time: live fleet output ticker ("US nuclear is generating ~95 GW right now — 18% of the grid"), restart tracker chips, "changed this week" markers on reactors whose status moved.

### Surface 2 — Reactor permalinks
Every unit gets a URL: `/reactor/browns-ferry-1`. Status, license history (already scraper-fed), power history sparkline (we're already storing daily status — start retaining history), upcoming NRC milestones, and the replacement-math module. These pages are the site's long tail: they're what gets linked from Reddit threads, Wikipedia citations, and local news stories about "our plant." **This is how a thesis site becomes a reference site.**

### Surface 3 — The Regulatory Radar
The ADAMS document feed plus NRC meeting schedules, filtered by consequence: license applications, restart milestones, SMR docket movements, uprate requests. Auto-summarized weekly into plain English ("Hatch's 80-year extension moved to final review; Clinton's renewal docketed"). This is the surface for the professional audience — the analysts, journalists, and staffers who currently maintain this awareness by hand.

### Surface 4 — The Monthly Gap Report
We already log every sync. Turn the deltas into prose, automatically drafted, human-skimmed: *"What changed in American nuclear in May 2026: one SLR approved (+1.6 GW rescued), Palisades held at 100% for its 12th consecutive month, two SMR dockets advanced."* Published on-site, syndicated by RSS/email. Twelve of these a year compound into being *the* chronicle of the transition.

### Surface 5 — The Scenario Explorer
The endgame artifact. The gap chart with the levers exposed: What if every pending SLR is approved? What if the pipeline slips five years? What if demand grows 2.5%/yr instead of 1%? What if the restarts all land? The user drags; the gap opens and closes. This converts readers from spectators into people who have *operated* the problem — and people who have operated a problem never go back to vibes.

---

## 5. Data architecture roadmap

The principle that got us here scales: **if it can't update itself, it doesn't ship.** Manual curation is reserved exclusively for editorial judgment (which SMR projects are credible), never for facts a cron can fetch.

| Source | What it feeds | Status |
|---|---|---|
| NRC daily power status | Fleet output, unit status | ✅ Live (daily cron) |
| NRC license renewal pages | License actions, expiration dates | ✅ Live (monthly cron) |
| EIA-860/operating-capacity | Reactor inventory | ✅ Seeded; promote to annual cron |
| **Daily status → history table** | Power sparklines, capacity-factor calc, outage detection | Next — we're discarding history we already fetch |
| **EIA-930 hourly generation** | Live ticker, 2 A.M. test, nuclear share of grid | Next |
| NRC ADAMS API | Regulatory Radar | Phase 3 |
| EIA-923 monthly generation | Actual TWh per plant, real capacity factors | Phase 3 |
| LBNL "Queued Up" / ISO queues | Interconnection context layer | Phase 3 |
| EIA-860 wind/solar inventory | Context map layer, replacement math | Phase 2–3 |
| IAEA PRIS | International panel (the "meanwhile, China" strip) | Phase 4 |
| NRC new-reactor dockets | SMR pipeline auto-tracking (replaces quarterly manual) | Phase 4 |

Schema implications, kept small: a `daily_status_history` table (date, unit, power %) starting now — it's free to collect and impossible to backfill; a `documents` table for ADAMS; `generation_hourly` aggregates for 930 data. Everything else is views.

---

## 6. What it looks like when it's working

Concrete scenes from the destination:

- A reporter covering the Clinton restart pulls up `/reactor/clinton-1`, screenshots the license timeline, and cites the site by name. The methodology link survives her editor.
- A Hill staffer gets the Monthly Gap Report in email, forwards it with one line: "this is the cleanest version of the numbers I've seen."
- A teenager on Reddit posts the 2 A.M. chart in an argument. Wins.
- An SMR developer's BD team keeps the Regulatory Radar open in a pinned tab because it's genuinely faster than their internal tracker.
- The gap chart — *our* chart, amber and green — shows up uncredited in a conference deck. Annoying. Also: victory.

And the quiet metric underneath all of it: **time-from-NRC-action-to-site-update stays under 24 hours, with zero hands.** That is the moat, and it must never regress.

---

## 7. What we will not become

Anti-goals, so future sessions don't drift:

- **Not a BI dashboard.** No filter sidebars with twelve facets. Every view earns its place by serving the story. Newspaper, not Tableau.
- **Not a culture-war account.** No dunking, no "renewables bros" discourse, no engagement farming. The site's tone is the tone of someone who is certain enough to be calm.
- **Not a doom counter.** The gap is the *tension*, not the message. The message is that the gap is closable and here are the machines closing it.
- **Not paywalled data.** The numbers are public records, re-plumbed. Charts, data, and methodology stay free and embeddable with attribution. If money ever matters, it comes from the professional surfaces (Radar, API tiers), never the public story.
- **Not multi-topic.** No drift into "all of energy." Other sources appear as context for the nuclear story, full stop. The day we add a natural-gas page is the day the site stops being about anything.

---

## 8. Sequencing (the honest version)

Phases, not dates — this is a nights-and-weekends institution, and the sequencing principle is *each phase must reduce the marginal cost of the next*:

1. **Polish the poster** — mobile layout, shareable deep links (`?iso=PJM`), OG cards so the chart unfurls beautifully when pasted into a group chat. *(Distribution before features — the chart that can't be shared can't recruit.)*
2. **Start the tape recorder** — daily-status history table + EIA-930 ingestion. Costs almost nothing now; every later surface (sparklines, capacity factors, 2 A.M. test, outage detection) consumes this tape. The earlier it starts, the richer everything downstream.
3. **Build the long tail** — reactor permalink pages from data we already hold.
4. **Add the professional surfaces** — Regulatory Radar, Monthly Gap Report (both are mostly prompt-engineering on top of feeds + sync_log).
5. **Open the levers** — scenario explorer, context layers, international strip.

Each phase ships something a visitor can feel. No phase requires a rewrite. The stack survives to V3 untouched except for new tables and new crons — which is the whole point of having built it boring.

---

## 9. The bet, stated plainly

The next decade of American electricity will be defined by whether firm clean power gets built at the speed demand now requires. Most people will form their opinion of that race from whatever picture is easiest to find.

The bet of this project: **if the honest picture is also the most beautiful and the most current one available, the honest picture wins.**

We can keep it honest with crons. We can keep it beautiful with restraint. We can keep it current for $0/month.

So we will still be here when the story resolves — and by then, being the site that was *right, daily, for years* will be an asset nobody can clone with a weekend and a scraper.

---

*Maintained alongside [CLAUDE.md](../CLAUDE.md) (working context) and [methodology.md](methodology.md) (data honesty). Update this file when the thesis itself moves, not for feature changes.*
