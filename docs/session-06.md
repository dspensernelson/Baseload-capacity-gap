# Session 6 — The Gap Chart

**Time estimate:** 2–3 hours  
**Goal:** One chart that makes the thesis undeniable.  
**End state:** A reader looks at this chart and immediately understands: retirements outpace new build, and the gap is the story.

---

## The Editorial Principle

This chart is an argument, not a dashboard. Every design decision should make the gap MORE legible, not just more data-rich. Resist adding lines, legends, or annotations that don't serve the thesis.

---

## Step 6.1 — Install Recharts

```bash
npm install recharts
```

---

## Step 6.2 — Build the Chart from the View

The `gap_series` view already computed everything. The component just renders it.

**Claude Code prompt:**
```
Update src/components/GapChart.jsx to render a Recharts ComposedChart using the gapSeries prop.

The chart should have:
- X axis: year (2025–2045), no gridlines
- Y axis: capacity in GW (divide MW values by 1000), label "GW"
- Two Area series:
  1. "Retiring capacity" — cumulative sum of retiring_mw by year, fill #6c757d (gray), line darker gray
  2. "New build" — cumulative sum of adding_mw by year, fill #2d6a4f (green), line darker green
- The gap between the two shaded in amber (#f4a261), using a ReferenceArea or custom rendering
- A vertical ReferenceLine at year 2035 labeled "2035"
- No legend — label the areas directly on the chart
- Tooltip showing year, retiring GW, adding GW, and net GW

The data passed in is already one row per year. Compute the cumulative sums in the component
using a running total (Array.reduce over sorted gapSeries).

Show me the code first.
```

---

## Step 6.3 — Shade the Gap

The amber gap between the two curves is the visual thesis. There are a few ways to implement it:

**Option A (simplest):** Use a Recharts `<ReferenceArea>` for the approximate gap area.

**Option B (accurate):** Use a custom SVG layer that fills between the two data lines. Ask Claude Code to generate a custom Recharts dot/shape or use a `<defs>` clip path approach.

Start with Option A. If the gap looks unconvincing, escalate to Option B.

**Label the gap directly:**
```jsx
<ReferenceLine 
  x={2035} 
  label={{ value: "← 12 GW gap by 2035", position: "insideTopRight", fill: "#f4a261" }} 
/>
```

Replace the hardcoded number with the `retiring_by_2035_mw` value from the headline data.

---

## Step 6.4 — Make It Honest

**Distinguish confirmed from speculative:**
In the `new_reactor_projects` table, projects have a `confidence` field: `'confirmed'` or `'speculative'`. The chart should visually distinguish these.

**Claude Code prompt:**
```
In GapChart.jsx, modify the new build area series to split into two:
1. Confirmed new build — solid fill (#2d6a4f)
2. Speculative new build — hatched or lighter fill (#52b788 with lower opacity)

The cumulative addition should stack both, but render them differently.
Speculative capacity should be clearly labeled as such.
```

**Add methodology link:**
```jsx
<p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
  <a href="/methodology" target="_blank">How we calculated this →</a>
</p>
```

---

## Step 6.5 — Write the Methodology Note

Create `public/methodology.html` (or add a route) with a plain-language explanation:

```markdown
## How We Calculated This

**Operating capacity:** Sourced from the EIA v2 API (operating-generator-capacity endpoint),
filtered to nuclear technology. Updated [date of last seed].

**Retirements:** Based on current NRC license expiration dates for operating reactors.
Does not assume license renewals unless already approved.

**New build:** Based on announced projects with active NRC review or DOE ARDP funding.
"Confirmed" = under construction or licensed. "Speculative" = in development/review.

**The gap:** Net capacity = operating today − cumulative retirements + cumulative confirmed additions.

This is a snapshot, not a forecast. License renewals, new project cancellations,
and policy changes will shift these numbers. Last updated: [date].
```

This single page is what separates a credible advocacy tool from a partisan one.

---

## Session 6 Complete When

- [ ] Chart renders with X axis 2025–2045, Y axis in GW
- [ ] Two area curves visible (retiring and new build)
- [ ] Gap between curves is shaded amber
- [ ] 2035 reference line annotated with the gap number
- [ ] Confirmed vs speculative new build visually distinct
- [ ] "How we calculated this" link present and links to real content
- [ ] Chart tells the thesis at a glance — show it to someone unfamiliar with the project and see if they get it
