# Session 4 — Frontend Skeleton

**Time estimate:** 2–3 hours  
**Goal:** React app reads live Supabase data and prints it in the browser. Ugly is fine. Connected is the point.  
**End state:** All three data sources (reactors, headline_numbers, gap_series) returning JSON in the browser.

---

## Step 4.1 — Scaffold the React App

```bash
npm create vite@latest nuclear-pipeline-tracker -- --template react
cd nuclear-pipeline-tracker
npm install
npm install @supabase/supabase-js
```

Add to `.env` (in the repo root or the app root — wherever Vite picks it up):
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important:** `VITE_` prefix is required for Vite to expose env vars to the browser. Never put the service key here.

---

## Step 4.2 — Create the Supabase Client

**Claude Code prompt:**
```
Create src/supabase.js that:
- Imports createClient from @supabase/supabase-js
- Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from import.meta.env
- Exports a single configured supabase client as default export

Nothing else in this file.
```

This is the single security chokepoint. Every component imports from here.

---

## Step 4.3 — Connect and Verify

**Claude Code prompt:**
```
Modify src/App.jsx to:
1. Import the supabase client from ./supabase
2. On mount (useEffect), fetch:
   a. All rows from the reactors table (select all columns)
   b. All rows from the headline_numbers view
   c. All rows from the gap_series view
3. Store each in state
4. Render each as a <pre>{JSON.stringify(data, null, 2)}</pre> block
   labeled "Reactors", "Headlines", "Gap Series"

This is a temporary test component — we'll replace it next step.
```

Run `npm run dev` and open the browser. You should see three blocks of JSON. This is the real milestone of this session — the entire pipeline is connected: EIA → Postgres → view → React.

**If the data doesn't appear:**
- Check browser console for CORS errors → Supabase anon key is wrong or RLS is blocking reads
- Check that the env var names match exactly (VITE_ prefix)
- Try querying the view directly in Supabase SQL editor to confirm it returns data

---

## Step 4.4 — Lay Out the Three-Screen Shell

**Claude Code prompt:**
```
Replace the test component in App.jsx with a proper layout shell.

Create three empty component files:
- src/components/Hook.jsx (renders <div>Map placeholder</div>)
- src/components/GapChart.jsx (renders <div>Chart placeholder</div>)  
- src/components/ReactorTable.jsx (renders <div>Table placeholder</div>)

Update App.jsx to:
- Import and render all three in order: Hook, GapChart, ReactorTable
- Wrap in a single scrolling page with max-width: 1200px, centered
- Add minimal global styles (reset, font-family: sans-serif, box-sizing: border-box)

No other styling. The goal is structure, not aesthetics.
```

Confirm the page loads with three placeholder divs in the correct order.

---

## Step 4.5 — Wire Data to Components (Prop or Context)

Decide how data flows. For v1 the simplest approach is fetching in `App.jsx` and passing down as props:

```jsx
// App.jsx
const [reactors, setReactors] = useState([])
const [headlines, setHeadlines] = useState(null)
const [gapSeries, setGapSeries] = useState([])

// pass down
<Hook reactors={reactors} />
<GapChart gapSeries={gapSeries} />
<ReactorTable reactors={reactors} />
```

**Claude Code prompt:**
```
Update App.jsx to fetch reactors, headline_numbers, and gap_series on mount
and pass them as props to Hook, GapChart, and ReactorTable respectively.
Each child component should just console.log its props for now.
```

Confirm the browser console shows data in all three components.

---

## Session 4 Complete When

- [ ] React app runs locally with `npm run dev`
- [ ] Reactor JSON appears in browser (from Supabase)
- [ ] `headline_numbers` data confirmed in browser
- [ ] `gap_series` data confirmed in browser
- [ ] Three screen components exist as stubs with correct props
- [ ] No credentials in any committed file
