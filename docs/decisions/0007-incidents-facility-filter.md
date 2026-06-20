# ADR-0007 — Incidents: plant events only

**Status:** Accepted · **Era:** June 2026

## Context
The NRC Event Notification Report is the live "something happened" wire — but it carries
*all* reportable events, most of which are materials/medical/agreement-state notices
(a radiography camera, a hospital dose event) with no connection to a power plant. The
Incidents tab is meant to be a *nuclear plant* feed.

## Decision
Parse every event, but **keep only rows that carry a `Facility` field** (reactor/plant
events) and drop the rest. Best-effort match the facility to our fleet (`reactor_id`).

## Consequences
- The feed reads as plant incidents — reactor trips, fitness-for-duty, tech-spec shutdowns —
  which is the visitor's intent.
- A few non-reactor *licensed-facility* events may pass; acceptable, still nuclear-facility.
- The parser was written against a **live CI fetch** of NRC's real HTML (the dev sandbox
  can't reach nrc.gov), and is deliberately defensive — it logs a raw sample to `sync_log`
  if it parses too few rows, so a format change is debuggable from the Actions log.
- Report discovery fetches dated report URLs directly (last ~30 days) rather than scraping
  an index, after the index approach silently returned only the current day.
