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
-- Column-level: anon may supply only email + source. A table-wide grant let a
-- direct PostgREST caller set status/confirmed/id itself, bypassing api/subscribe.js.
-- Supabase's default privileges also hand anon SELECT/UPDATE/REFERENCES here; RLS
-- denies them today, but an unintended grant is one permissive policy from a leak.
revoke all on public.subscribers from anon;
grant insert (email, source) on public.subscribers to anon;

-- Same bounds api/subscribe.js enforces, held at the table so the direct path can't skip them.
alter table public.subscribers drop constraint if exists subscribers_email_sane;
alter table public.subscribers add constraint subscribers_email_sane
  check (length(email) <= 254 and email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');
alter table public.subscribers drop constraint if exists subscribers_source_sane;
alter table public.subscribers add constraint subscribers_source_sane
  check (source is null or length(source) <= 60);

-- One-click unsubscribe (api/unsubscribe.js): anon may flip exactly one row
-- to 'unsubscribed' if it knows that row's UUID, which only ever travels
-- inside that subscriber's own email (standard unsubscribe-token pattern).
--
-- This is a SECURITY DEFINER RPC, not a table-level UPDATE grant + RLS
-- policy. That was the first cut and it's unsafe: PostgREST/Postgres can't
-- evaluate `WHERE id = eq.<uuid>` for a row anon has no SELECT visibility
-- into, so a bare `using (true)` UPDATE policy silently matches zero rows.
-- The fix is *not* to add a permissive SELECT policy — combined with the
-- UPDATE policy's `using (true)` that would let anyone enumerate every
-- subscriber id via `?select=id` and then mass-unsubscribe the whole list.
-- The function runs with the owner's privileges internally (bypassing RLS
-- for this one targeted UPDATE) while anon only ever gets EXECUTE — no
-- table-level SELECT or UPDATE grant at all, so the list stays fully
-- unreadable and there is no enumeration surface.
create or replace function public.unsubscribe_subscriber(sub_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscribers
     set status = 'unsubscribed', unsubscribed_at = now()
   where id = sub_id;
end;
$$;

revoke all on function public.unsubscribe_subscriber(uuid) from public;
grant execute on function public.unsubscribe_subscriber(uuid) to anon;
