-- Daily grid reliability + firming snapshots, materialized by
-- scripts/grid_reliability_daily.py from generation_hourly. Public read-only
-- (anon SELECT) so the Grid page can render them; writes are service-key only.

create table if not exists public.grid_reliability_daily (
  snapshot_date date not null,
  source_key text not null,
  avg_gw numeric,
  p10_gw numeric,
  p90_gw numeric,
  cv_pct numeric,
  ramp95_gw numeric,
  hours_observed integer,
  updated_at timestamptz not null default now(),
  primary key (snapshot_date, source_key)
);

create table if not exists public.grid_firming_daily (
  snapshot_date date primary key,
  overnight_nuclear_gw numeric,
  overnight_solar_gw numeric,
  overnight_wind_gw numeric,
  overnight_total_gw numeric,
  midday_solar_gw numeric,
  overnight_nuclear_share_pct numeric,
  low_renewables_hours_pct numeric,
  nuclear_share_when_low_renewables_pct numeric,
  hours_observed integer,
  updated_at timestamptz not null default now()
);

alter table public.grid_reliability_daily enable row level security;
alter table public.grid_firming_daily enable row level security;

drop policy if exists grid_reliability_daily_anon_read on public.grid_reliability_daily;
create policy grid_reliability_daily_anon_read
  on public.grid_reliability_daily for select to anon using (true);

drop policy if exists grid_firming_daily_anon_read on public.grid_firming_daily;
create policy grid_firming_daily_anon_read
  on public.grid_firming_daily for select to anon using (true);
