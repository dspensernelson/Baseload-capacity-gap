-- daily_status_history — one row per reactor per NRC report date.
-- Written forward by scripts/nrc_daily_status.py (daily cron) and backfilled
-- from the NRC 365-day file by scripts/backfill_status_history.py.
-- Idempotent: unique (reactor_id, report_date) supports upsert on conflict.

create table if not exists public.daily_status_history (
  id          uuid primary key default gen_random_uuid(),
  reactor_id  uuid not null references public.reactors(id) on delete cascade,
  report_date date not null,
  power_pct   integer,        -- NRC power as integer percent; null if non-numeric
  status_text text,           -- raw display string, e.g. "100% power"
  recorded_at timestamptz not null default now(),
  unique (reactor_id, report_date)
);

create index if not exists idx_dsh_reactor_date
  on public.daily_status_history (reactor_id, report_date desc);

alter table public.daily_status_history enable row level security;

create policy "public read daily_status_history"
  on public.daily_status_history for select
  using (true);
