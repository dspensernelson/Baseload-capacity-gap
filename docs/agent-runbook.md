# Agent Runbook — Working with Claude Code on Nuclear Pipeline Tracker

> 🏺 **Historical (V1 build log).** This describes the original 8-session, human-in-the-loop
> manual build. The project is now **agent-built and agent-run** — for current process see
> [`CLAUDE.md`](../CLAUDE.md) (working context), [`ARCHITECTURE.md`](ARCHITECTURE.md), and
> [`REBUILD.md`](REBUILD.md). Kept as a period artifact; the `docs/session-01..08.md` files
> are the matching build narrative. Don't follow this as current process.

How to get the most out of Claude Code across the 8 build sessions. Read this before starting any session.

---

## The Core Pattern

Every session follows the same loop:

1. **Orient the agent** — tell it which session you're in and what the goal is
2. **Delegate the code generation** — let it write, you read it line by line
3. **You verify the output** — run it, check the data, confirm it matches expectations
4. **Never black-box ETL** — always read data scripts before executing them

---

## Starting a Session

Open Claude Code in the repo root and send this prompt at the start of every session:

```
Read CLAUDE.md and docs/session-0X.md (replace X with the session number).
Then tell me: what's the goal for this session, what are the steps, 
and what should I verify at the end?
```

This forces the agent to orient itself on the project context before writing anything.

---

## What to Delegate to Claude Code

**High-confidence delegations** (agent writes, you review):
- Boilerplate setup: folder structure, `package.json`, `.gitignore`, Vite config
- Supabase client setup (`src/supabase.js`)
- SQL DDL for tables — review column names and types
- Seed script skeleton — review field mapping before running
- React component scaffolding — stub components with correct props
- EIA API pagination loop
- Recharts component structure

**Medium-confidence delegations** (agent writes, you test carefully):
- EIA field mapping → `reactors` columns (verify with spot-checks)
- SQL views (`headline_numbers`, `gap_series`) — verify output in Supabase editor
- MapLibre pin layer with color encoding
- Filter/sort logic in `ReactorTable`

**Do yourself, with agent assistance** (you drive, agent assists):
- Manual data entry for SMR pipeline and decommissioning (you know the data)
- Visual identity decisions (brand color, type choices)
- "How we calculated this" methodology text
- Decisions about what is confirmed vs speculative

---

## Prompt Patterns That Work Well

### For setup tasks
```
Create [file/folder] with [specific structure]. 
Use the conventions in CLAUDE.md.
Show me the code before creating any files.
```

### For ETL scripts
```
Write a Python script that:
1. Loads EIA_API_KEY from .env
2. Calls [specific endpoint] with [specific params]
3. Paginates until no rows remain
4. Maps fields as follows: [paste the mapping from data-model.md]
5. Upserts into Supabase keyed on eia_plant_id + unit_number
6. Prints row count

Don't run it yet — show me the code first.
```

### For SQL views
```
Write a Postgres view called [view_name] that returns [describe exactly what rows/columns].
Base it on the schema in docs/data-model.md.
Explain the logic before I run it.
```

### For React components
```
Create src/components/[Component].jsx that:
- Fetches [specific table/view] using the client from src/supabase.js
- Renders [describe what the user should see]
- Does NOT do any aggregation — just reads from the view

Use functional components with hooks. No aggregation logic in the component.
```

### For debugging
```
The [script/component] is returning [unexpected result].
Expected: [what you expected]
Actual: [what you got]
Here's the relevant code: [paste it]
What's wrong?
```

---

## Things to Always Verify Yourself

These are checkpoints where the agent's output must be confirmed by a human before moving on:

| Checkpoint | What to check |
|------------|---------------|
| After `seed_reactors.py` | ~94 rows in Supabase; spot-check Vogtle, Diablo Canyon, Palo Verde |
| After `headline_numbers` view | `operating_mw` ≈ 97,000 |
| After `gap_series` view | 2025 row ≈ operating base; trend makes sense |
| After frontend connects | JSON appears in browser from all three data sources |
| After map renders | Pins at correct coordinates; color matches status |
| After cron runs | Row in `sync_log`; `daily_status` updated on matching reactors |

---

## What the Agent Doesn't Know (Tell It Explicitly)

- **Your `.env` file** — never share it, but tell the agent which keys exist: `EIA_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Your current session** — always tell it "we're on Session X, step Y"
- **What you've already done** — paste the relevant checklist section so it doesn't redo completed work
- **Visual decisions** — paste your brand color and font choices when working on Sessions 7–8

---

## Common Mistakes to Avoid

**Don't let the agent run scripts without you reviewing them first.**
Always say "show me the code first, don't run it."

**Don't aggregate in React components.**
If you find a component doing `reduce()` or `filter()` to compute a headline number, stop and move that logic into a Postgres view instead.

**Don't put the service key in the frontend.**
Only `VITE_SUPABASE_ANON_KEY` belongs in the React app. The service key is for server-side scripts only.

**Don't skip the `sync_log` write in the cron.**
This is the audit trail. If the agent writes a cron that doesn't write to `sync_log`, ask it to add that before deploying.

**Don't build V2 features during V1.**
If the agent suggests adding auth, realtime, or mobile layout, redirect it. Point it at the V2 parking lot in `CLAUDE.md`.

---

## Session-by-Session Agent Focus

| Session | Primary agent task | You do |
|---------|--------------------|--------|
| 1 | Write seed script, EIA pagination loop | Review field mapping, run script, spot-check |
| 2 | Write remaining DDL, patch scripts | Manual data entry for SMR/decomm |
| 3 | Write SQL views | Verify numbers in SQL editor |
| 4 | Scaffold React app, wire Supabase client | Confirm JSON in browser |
| 5 | Write MapLibre component, pin layer | Verify pin locations, click interactions |
| 6 | Write Recharts gap chart | Verify chart tells the right story |
| 7 | Write table component, filter logic | Visual identity decisions |
| 8 | Write cron script, deploy config | Set env vars in Vercel, confirm cron fires |

---

## Updating CLAUDE.md

At the end of each session, update the "Current Session" section in `CLAUDE.md`:

```markdown
## Current Session

**Active session:** Session X — [title]
**Last completed:** Session X-1 — [title]
**Blockers:** [any open issues, or "none"]
```

This means the next session starts with full context even if you're picking up days later.
