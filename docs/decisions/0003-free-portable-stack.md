# ADR-0003 — A free, portable stack

**Status:** Accepted · **Era:** V1

## Context
This is a nights-and-weekends institution meant to outlast its operator's attention and any
funding. Recurring cost and vendor lock-in are the two things that quietly kill projects like
this. The destination is an institution with *no staff* — so it must also cost *no money*.

## Decision
**Supabase (Postgres) + Vercel + GitHub Actions + MapLibre**, all free tier, all portable.
Postgres is standard Postgres; the frontend is static; the crons are plain Python.

## Consequences
- **$0/month.** Institutions that cost nothing don't die of funding.
- Portable: the database is exportable Postgres; nothing depends on a proprietary runtime.
- Free-tier limits are generous for ~200 reactor rows + hourly grid data; if ever exceeded,
  the same code moves to any Postgres host.
- A real constraint: heavy compute (LLM content) must stay deliberate, not default.
