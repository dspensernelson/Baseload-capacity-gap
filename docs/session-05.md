# Session 5 — The Map (The Hook)

**Time estimate:** 3–4 hours  
**Goal:** US map with color-coded reactor pins and ISO/RTO district overlays.  
**End state:** The emotional center of the product. A visitor immediately understands nuclear's footprint.

---

## Step 5.1 — Install MapLibre and Base Map

```bash
npm install maplibre-gl
```

Add MapLibre CSS import to your `main.jsx` or `index.css`:
```js
import 'maplibre-gl/dist/maplibre-gl.css'
```

**Free map style URLs (no token required):**
- OpenFreeMap Positron: `https://tiles.openfreemap.org/styles/positron`
- CARTO Positron: `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`

**Claude Code prompt:**
```
Update src/components/Hook.jsx to:
1. Initialize a MapLibre map using a ref (useRef + useEffect)
2. Use the CARTO Positron style: https://basemaps.cartocdn.com/gl/positron-gl-style/style.json
3. Center on continental US: center [-98, 39], zoom 4, minZoom 3, maxZoom 10
4. Container height: 600px, width: 100%
5. No attribution modification needed

Import maplibre-gl and its CSS. Show me the code first.
```

Verify the base map renders before adding any data layers.

---

## Step 5.2 — Reactor Pins, Colored by Status

**Color encoding:**
| Status | Color |
|--------|-------|
| `operating` | `#2d6a4f` (forest green) |
| `shutdown` | `#6c757d` (gray) |
| `decommissioning` | `#e76f51` (orange-red) |
| `license_renewed` | `#52b788` (light green) |
| Pipeline (from `new_reactor_projects`) | `#457b9d` (steel blue) |

**Size encoding:** `capacity_mw` → circle radius. Use a MapLibre expression:
```json
["interpolate", ["linear"], ["get", "capacity_mw"], 500, 6, 1300, 14]
```

**Claude Code prompt:**
```
Add a GeoJSON source and circle layer to the Hook map that:
1. Converts the reactors prop (array of reactor objects) to GeoJSON format
   (type: "FeatureCollection", features with geometry.coordinates [lng, lat]
   and properties matching all reactor fields)
2. Adds a circle layer with:
   - circle-color based on status using a MapLibre match expression
     operating → #2d6a4f, shutdown → #6c757d, decommissioning → #e76f51, default → #6c757d
   - circle-radius interpolated from capacity_mw (500→6, 1300→14)
   - circle-stroke-width: 1, circle-stroke-color: white, circle-opacity: 0.85
3. Updates the source data when the reactors prop changes

Add this after the map 'load' event fires.
```

---

## Step 5.3 — Detail Panel on Pin Click

**Claude Code prompt:**
```
Add a click handler to the reactor circle layer that:
1. Gets the clicked feature's properties
2. Shows a detail panel (absolutely positioned div over the map, top-right corner) with:
   - Plant name and unit number as the title
   - Operator
   - Capacity (MW)
   - Commercial operation date
   - License expiration date
   - Status (styled with the matching color)
   - daily_status if not null ("100% power" / "offline")
3. Closes on clicking an X button or clicking elsewhere on the map

Style the panel minimally — white background, padding, subtle shadow, readable font.
```

---

## Step 5.4 — ISO/RTO Boundary Overlays

**Get the GeoJSON:**
Download ISO/RTO boundaries from: https://hifld-geoplatform.opendata.arcgis.com/datasets/electric-planning-areas

Or use this curated source with the standard 8 regions: search GitHub for "us-iso-rto-boundaries geojson" — several clean versions exist.

Save the file as `public/iso-rto-boundaries.geojson`.

**Claude Code prompt:**
```
Add ISO/RTO boundaries to the Hook map:
1. Fetch /iso-rto-boundaries.geojson on map load
2. Add it as a fill layer beneath the reactor pins layer with:
   - fill-color: a data-driven expression matching ISO name to a soft color palette
     (use 8 muted, distinct colors — not the reactor status colors)
   - fill-opacity: 0.12
3. Add a line layer on the same source:
   - line-color: #999
   - line-width: 1
   - line-opacity: 0.4
4. On ISO region click, update a selectedISO state variable

Don't implement filtering yet — just capture the selected region.
```

---

## Step 5.5 — Regional Filter (ISO Click → Filter Table)

When a user clicks an ISO/RTO region, the reactor table and headline numbers should filter to that region. The cleanest approach: lift `selectedISO` state to `App.jsx` and filter the reactors array before passing to `ReactorTable`.

**Claude Code prompt:**
```
Update App.jsx and Hook.jsx to:
1. Manage selectedISO state in App.jsx
2. Pass a setSelectedISO callback down to Hook
3. Filter the reactors array in App.jsx: 
   if selectedISO is set, filter to reactors where iso_rto === selectedISO
4. Pass the filtered array to ReactorTable
5. Show the selected ISO name in a small label above the map with a "Clear" button

Don't filter the headline numbers yet — that's a stretch goal.
```

---

## Session 5 Complete When

- [ ] Base map renders with CARTO Positron style
- [ ] ~94 reactor pins appear at correct US coordinates
- [ ] Pins are colored by status and sized by capacity
- [ ] Clicking a pin shows a detail panel with correct data
- [ ] ISO/RTO boundaries visible as translucent overlays
- [ ] Clicking an ISO region filters the reactor table
- [ ] Map feels like the emotional hook — someone lands on it and immediately gets it
