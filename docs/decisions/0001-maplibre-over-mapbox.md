# ADR-0001 — MapLibre over Mapbox

**Status:** Accepted · **Era:** V1

## Context
The site needs an interactive US map. Mapbox is the obvious choice but requires an access
token, an account, and a billing surface that can be exceeded. This project's whole premise
is $0/month and zero-ops — a key that can leak, rotate, or rack up a bill is a liability.

## Decision
Use **MapLibre GL** (the open fork) with a free vector style (OpenFreeMap / CARTO). No token,
no account, no billing.

## Consequences
- No credential to leak, rotate, or budget. One fewer secret.
- Slightly fewer turnkey styles than Mapbox; irrelevant for a newspaper-style map.
- Reinforces the portability/longevity goal (see [0003](0003-free-portable-stack.md)).
