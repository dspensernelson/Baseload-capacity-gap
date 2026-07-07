-- Newsletter signups. RLS is insert-only for the anon role so the public web
-- form can add an address but the list is never readable through the anon key.
-- The service key (server-side scripts/send_newsletter.py) reads the active list.
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  status text not null default 'active',
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index if not exists subscribers_status_idx on public.subscribers (status);

alter table public.subscribers enable row level security;

drop policy if exists subscribers_anon_insert on public.subscribers;
create policy subscribers_anon_insert
  on public.subscribers
  for insert
  to anon
  with check (true);

-- Insert privilege for the public web form; reads stay blocked (no SELECT policy).
grant insert on public.subscribers to anon;

-- One-click unsubscribe (api/unsubscribe.js): anon may flip a row to
-- 'unsubscribed' — and nothing else — if it knows the row's UUID. The UUID is
-- unguessable and only ever delivered inside that subscriber's own email, so
-- this is the standard unsubscribe-token pattern. Column grants are limited to
-- (status, unsubscribed_at); the list stays unreadable (no SELECT policy means
-- anon reads return zero rows even with the id column privilege below, which
-- exists only so the UPDATE's WHERE id = ... filter is allowed).
grant select (id) on public.subscribers to anon;
grant update (status, unsubscribed_at) on public.subscribers to anon;

drop policy if exists subscribers_anon_unsubscribe on public.subscribers;
create policy subscribers_anon_unsubscribe
  on public.subscribers
  for update
  to anon
  using (true)
  with check (status = 'unsubscribed');
