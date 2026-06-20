# ADR-0005 — Tab theory: one tab per visitor question

**Status:** Accepted · **Era:** V1 → ongoing

## Context
Features started piling onto one long scrolling page (a 2 a.m. view here, a replacement
calculator there). Without a placement rule, the site drifts toward a BI dashboard with
forty toggles — the opposite of the newspaper-graphic aesthetic.

## Decision
**One tab per visitor question.** A feature is placed by the question it answers, not by
whatever page is handy:

Overview = the argument · History = how we got here · Map = places · The Fleet = our own
performance · The Grid = vs. other sources · Incidents = what's happening now · Safety = is
it actually safe · Dispatches = what changed · Scenarios = what-ifs · The Data = the raw
records · The Sources = how we know.

## Consequences
- Clean information architecture; each view earns its place by serving the story.
- Now 11 tabs — watch for crowding; if it grows, group under a menu rather than abandon the rule.
- "Newspaper, not Tableau" stays enforceable: a proposed feature that doesn't answer a clear
  visitor question doesn't ship.
