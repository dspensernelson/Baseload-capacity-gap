# ADR-0015 — The wholesale-pricing layer: a CAISO pilot, not an EIA shortcut

**Status:** Accepted · **Era:** Post-V1, June 2026

## Context
The Grid's "2 a.m. test" shows nuclear's flat output against solar/wind's variability. The
natural extension is price: intermittency shows up as price volatility, a cost flat output
doesn't carry. The original plan was to start with EIA wholesale price data — same sourcing
family as everything else on the site — and treat real per-ISO LMP data as a bigger lift for
later.

That plan turned out to be wrong, verified directly against the live EIA API rather than
assumed: `GET api.eia.gov/v2/electricity/` lists exactly six routes (retail-sales,
electric-power-operational-data, rto, state-electricity-profiles,
operating-generator-capacity, facility-fuel) — **no wholesale price route exists**. EIA's own
[wholesale-markets page](https://www.eia.gov/electricity/wholesale/) is a biweekly Excel file
licensed from ICE (a commercial exchange), not EIA's own collected data, and biweekly
high/low/weighted-average prices can't show hour-by-hour volatility at all — the wrong shape
of data for this specific story, not just a coarser version of the right one.

## Decision
- **No EIA shortcut exists for this.** The real choice was always per-ISO LMP data; there's
  no smaller stepping stone.
- **Pilot one ISO: CAISO**, verified live against the real API before writing any code —
  `oasis.caiso.com/oasisapi/SingleZip`, `queryname=PRC_LMP`, `market_run_id=DAM`, hourly,
  free, public, **no API key or registration** (OASIS is a regulatory-mandated public data
  system — more open than EIA's own API, which at least needs a key). Confirmed a 3-day
  range returns in one request; no observed 1-day cap.
- **Two hubs: NP15 and SP15** — the same two benchmark hubs EIA's own (Excel-only) wholesale
  report tracks, which is a nice consistency point: same hubs the rest of the industry
  already treats as "the" California benchmark.
- **Day-ahead, not real-time.** Matches `GridMix`'s hourly cadence exactly, is the more
  stable/documented endpoint, and is still volatile enough to tell the story — CAISO's
  midday-low/evening-spike "duck curve" shows up clearly even one market ahead of real-time.
  Real-time (`PRC_RTPD_LMP`/`PRC_INTVL_LMP`) is a possible later refinement, not required now.
- **Schema is multi-ISO-ready without overbuilding now**: `wholesale_prices` has real `iso`
  and `market` columns (not hardcoded constants) so ERCOT, PJM, or real-time prices later is
  a new script writing into the same table, not a migration. See
  [supabase/wholesale_prices.sql](../../supabase/wholesale_prices.sql).
- Rendered on `/grid` immediately after `GridMix`, captioned "Pilot: California only" — the
  scope limit is stated on the page itself, not hidden.

## Consequences
- This is the second time this session a stated plan got corrected by checking the actual
  API instead of trusting a prior assumption (the demand-band band-vs-axis bug was the
  first) — worth keeping as the default move before building on an unverified data-source
  claim, especially for anything that becomes a public, cited number.
- No new secret to manage: CAISO OASIS needs no key, unlike every other data source in the
  stack. Genuinely the lowest-friction source added so far.
- Not watchdog-monitored yet (same as `generation_hourly` — degrades gracefully if a fetch is
  missed). Could be added later if this graduates past pilot status.
