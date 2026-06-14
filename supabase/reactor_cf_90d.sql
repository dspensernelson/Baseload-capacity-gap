-- reactor_cf_90d — per-reactor 90-day average power (a capacity-factor proxy)
-- plus offline-day count, from daily_status_history. Powers the "Who ran
-- hardest, last 90 days" lists on The Fleet (CapacityFactor.jsx).

create or replace view public.reactor_cf_90d as
select
  r.id            as reactor_id,
  r.plant_name,
  r.unit_number,
  r.capacity_mw,
  round(avg(h.power_pct))::int            as avg_power_90d,
  count(*) filter (where h.power_pct = 0) as offline_days,
  count(*)                                 as days
from public.daily_status_history h
join public.reactors r on r.id = h.reactor_id
where h.report_date >= current_date - 90
  and r.status in ('operating', 'license_renewed')
group by r.id, r.plant_name, r.unit_number, r.capacity_mw;

grant select on public.reactor_cf_90d to anon, authenticated;
