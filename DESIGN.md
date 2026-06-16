# Nuclear Pipeline Tracker — High-Level Design

> Conceptual architecture, data flow, and component map. Read this before any session to orient yourself on how the pieces fit together.

---

## The Thesis

US nuclear capacity is quietly retiring faster than new build is coming online. This product makes that gap visible, legible, and emotionally real to a curious public audience. Everything in the design serves that thesis — no feature exists that doesn't support it.

---

## Three Screens, One Argument

```
┌─────────────────────────────────────────────┐
│  HEADLINE BAND                              │
│  102 GW operating │  -13 GW by 2035  │  +2 GW pipeline  │
└─────────────────────────────────────────────┘

┌──────────────────────────────┐
│  THE HOOK (Map)              │  ← emotional entry point
│  US map, reactor pins        │    colored by status,
│  ISO/RTO overlays            │    sized by capacity
└──────────────────────────────┘

┌──────────────────────────────┐
│  THE GAP CHART               │  ← the thesis, made undeniable
│  Retirements ↓  New build ↑  │    amber shading = the gap
│  2025 → 2045                 │
└──────────────────────────────┘

┌──────────────────────────────┐
│  REACTOR TABLE               │  ← the detail layer
│  Filterable, sortable        │    find your local plant
└──────────────────────────────┘
```

The visual hierarchy is fixed: Hook → Gap → Table. This is the reading order of the argument.

---

## System Architecture

```
External Data Sources
        │
        ▼
┌───────────────────┐     ┌──────────────────────┐
│  EIA v2 API       │     │  NRC Daily Status     │
│  (reactor seed)   │     │  (text file, daily)   │
└────────┬──────────┘     └──────────┬───────────┘
         │                           │
         ▼                           ▼
┌─────────────────────────────────────────────────┐
│              Supabase (Postgres)                │
│                                                 │
│  Tables:                                        │
│    reactors              ← core entity          │
│    new_reactor_projects  ← SMR/new build        │
│    decommissioning       ← retirements          │
│    license_actions       ← renewals/expirations │
│    sync_log              ← cron audit trail     │
│                                                 │
│  Views:                                         │
│    headline_numbers      ← 3 summary stats      │
│    gap_series            ← year-by-year delta   │
└────────────────────┬────────────────────────────┘
                     │
                     │ Supabase JS client
                     ▼
┌─────────────────────────────────────────────────┐
│              React + Vite Frontend              │
│                                                 │
│  src/supabase.js   ← single configured client  │
│  src/App.jsx       ← layout shell              │
│                                                 │
│  Components:                                    │
│    Hook.jsx        → MapLibre map               │
│    GapChart.jsx    → Recharts area chart        │
│    ReactorTable.jsx → filterable table          │
└─────────────────────────────────────────────────┘
                     │
                     ▼
              Vercel / Netlify
              (public URL)
```

---

## Data Flow

### Seed (one-time, manual)

```
EIA API → seed_reactors.py → reactors table (upsert)
NRC / DOE pages → manual SQL inserts → new_reactor_projects, decommissioning
```

### Daily cron (automated, v1)

```
NRC status text file → Edge Function / GitHub Action → reactors.daily_status + sync_log row
```

### Read path (every page load)

```
Browser → supabase.js client → Supabase RLS (anon key, read-only)
  → reactors (map pins)
  → headline_numbers view (band)
  → gap_series view (chart)
  → reactors (table, client-side filter/sort)
```

---

## Key Architectural Decisions

### Editorial math lives in SQL, not React

All aggregation — the headline numbers, the year-by-year gap — is computed in Postgres views. React components consume views and render. This means the editorial math is in one auditable place. If numbers are wrong, fix the view.

### Client-side filtering for the table

With ~200 rows max, there's no need for server-side pagination. All filter/sort logic runs in the browser. This simplifies the component and removes round-trip latency.

### One Supabase client, everywhere

`src/supabase.js` exports a single configured client. No component ever holds credentials or constructs its own client. This is the single security chokepoint.

### Upsert, not insert, on seed scripts

Every seed script uses upsert keyed on `eia_plant_id + unit_number`. Re-running is always safe — no duplicates, no data loss.

### Anon key on the frontend

Supabase anon key is safe to expose — it's read-only and Row Level Security (RLS) should be configured to allow only SELECT. Never put the service key in the frontend.

---

## Component Map

```
App.jsx
├── HeadlineBand          ← reads headline_numbers view
├── Hook                  ← reads reactors (lat/lng, status, capacity)
│   ├── MapLibre map
│   ├── ReactorPins       ← colored + sized markers
│   ├── ISOOverlay        ← GeoJSON fill layer
│   └── DetailPanel       ← shown on pin click
├── GapChart              ← reads gap_series view
│   ├── AreaChart (Recharts)
│   ├── GapShading        ← amber fill between curves
│   └── ReferenceLines    ← 2035 annotation
└── ReactorTable          ← reads reactors
    ├── FilterBar         ← status, state, operator, expiration window
    └── SortableTable
```

---

## What V1 Deliberately Excludes

| Feature | Why deferred |
|---------|-------------|
| Auth / user accounts | Not needed for a public read-only visualization |
| Realtime websockets | Daily cron is sufficient for v1 |
| Mobile layout | Desktop-first; mobile is v2 |
| Wind/solar comparison | Scope; would dilute the nuclear thesis |
| EIA-923 monthly generation | Orchestration layer (Paperclip) in v2 |
| ADAMS document feeds | Complexity; v2 |
| Shareable deep links | v2 |
| Payments | v2 |

---

## V2 Seam

V1 is deliberately built by hand to understand the shape of the problem. The handoff to orchestration (Paperclip) happens after v1 is public. The seam is:

- Data maintenance crons → delegated to Data Engineer agent
- NRC/EIA scraping → delegated to Scraper agent  
- Content updates → delegated to Content agent
- You → board-level direction, not execution

V1 gives you the data engineering and visualization fundamentals. The agent org amplifies them.
