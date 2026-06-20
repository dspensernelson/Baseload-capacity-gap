# ADR-0009 — Anon key on the frontend

**Status:** Accepted · **Era:** V1

## Context
The React app talks to Supabase directly (no backend server). It needs a credential, and
that credential is visible to anyone who views source.

## Decision
Ship **only the anon key** to the browser, with **Row Level Security allowing SELECT only**.
The **service key** (full access) lives exclusively in server-side scripts and GitHub Actions
secrets — never in Vercel env that reaches the client, never in the repo.

## Consequences
- The database doubles as a safe, public, read-only REST API (this is what powers the open-data
  page and lets others build on the data).
- No backend server to run, secure, or pay for.
- The blast radius of the public key is "read public data," which is the point.
- Hard rule: if a feature ever needs writes from the client, it goes through a server-side
  function — the service key never moves to the frontend.
