# ADR-0012 — Thin read-only Vercel functions for distribution

**Status:** Accepted · **Era:** Post-V1, June 2026

## Context
Distribution work (OG share cards, an RSS feed) doesn't fit the static-SPA model cleanly.
Social crawlers (Twitter/Facebook/Slack/Discord) don't execute JS, so an `og:image` has to
exist as a real file at a stable URL — and to show *live* headline numbers without a
rebuild, it has to be generated, not drawn once and committed. An RSS feed has the same
problem in miniature: it needs to reflect new Dispatches the moment `monthly-dispatch.yml`
writes one, with no code push in between.

## Decision
Add exactly two Vercel serverless functions, both read-only and both using only the public
**anon key** — the same credential and blast radius the frontend already carries (see
[0009](0009-anon-key-frontend.md)):

- **`api/og.js`** (Edge runtime, `@vercel/og`) — renders a branded 1200×630 share card from
  `headline_numbers` on every request. No caching beyond a 1-hour HTTP `Cache-Control`.
- **`api/rss.js`** (Node runtime) — renders RSS 2.0 from `reports` on every request, one
  item per Dispatch, linking to its `/dispatches/:period` permalink.

Neither function writes data, holds a secret, or needs the service key. Both are stateless
and trivially deletable.

## Consequences
- This is the first server-side compute in the stack beyond GitHub Actions crons — it
  narrows the "no backend server" framing in [`ARCHITECTURE.md`](../ARCHITECTURE.md)'s
  one-sentence shape to "no *application* server": these two functions render presentation
  artifacts from already-public data, they don't add business logic, auth, or writes.
- `@vercel/og`'s image renderer is WASM-based and only runs in a real Edge runtime (Vercel
  or `vercel dev`) — it cannot be smoke-tested under plain Node. `api/rss.js` has no such
  constraint and was verified locally against live data before shipping.
- Future distribution features (e.g. per-reactor OG cards) should extend these two
  functions rather than open new server surfaces, to keep the "boring stack" property —
  see [0003](0003-free-portable-stack.md).
