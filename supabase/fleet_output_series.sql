-- fleet_output_series — daily U.S. nuclear fleet output, derived from the
-- daily_status_history tape. One row per report date: summed generation
-- (capacity x power%), summed available capacity, and outage counts.
-- Powers the "The Fleet, Last 12 Months" chart. Read by the anon client.

create or replace view public.fleet_output_series as
select
  h.report_date,
  round(sum(r.capacity_mw * coalesce(h.power_pct, 0) / 100.0))      as output_mw,
  round(sum(r.capacity_mw))                                          as capacity_mw,
  count(*) filter (where h.power_pct = 0)                            as units_offline,
  count(*)                                                           as units_reporting
from public.daily_status_history h
join public.reactors r on r.id = h.reactor_id
where r.status in ('operating', 'license_renewed')
  and r.capacity_mw is not null
group by h.report_date
order by h.report_date;

grant select on public.fleet_output_series to anon, authenticated;
