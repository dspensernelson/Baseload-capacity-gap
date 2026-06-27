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
