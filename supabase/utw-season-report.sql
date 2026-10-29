-- Aggregate current snapshots within one season, excluding superseded CSV uploads.
create or replace function public.utw_stat_season_report(p_season text)
returns table (
 member_id uuid,
 member_name text,
 vs_daily_total bigint,
 vs_weekly_total bigint,
 donations_total bigint,
 recorded_vs_days bigint,
 recorded_vs_weeks bigint,
 trains_awarded bigint
)
language sql stable security invoker set search_path=public,pg_temp
as $$
with current_uploads as (
 select distinct on (metric,period) id,metric,period
 from public.utw_stat_imports
 where season_id=p_season
 order by metric,period,created_at desc,id desc
), scored as (
 select a.member_id,
  coalesce(sum(v.points) filter(where c.metric='vs_daily'),0)::bigint as daily,
  coalesce(sum(v.points) filter(where c.metric='vs_weekly'),0)::bigint as weekly,
  coalesce(sum(v.points) filter(where c.metric='donations_weekly'),0)::bigint as donations,
  count(distinct c.period) filter(where c.metric='vs_daily') as days,
  count(distinct c.period) filter(where c.metric='vs_weekly') as weeks
 from current_uploads c
 join public.utw_stat_values v on v.import_id=c.id
 join public.utw_stat_aliases a on a.alias_key=v.alias_key
 group by a.member_id
), awarded as (
 select member_id,count(*)::bigint as count
 from public.utw_stat_awards
 where season_id=p_season
 group by member_id
)
select m.id,m.display_name,coalesce(s.daily,0),coalesce(s.weekly,0),
 coalesce(s.donations,0),coalesce(s.days,0),coalesce(s.weeks,0),coalesce(w.count,0)
from public.utw_stat_members m
left join scored s on s.member_id=m.id
left join awarded w on w.member_id=m.id
where s.member_id is not null or w.member_id is not null
order by coalesce(s.weekly,0) desc,coalesce(s.donations,0) desc,m.display_name
$$;
revoke all on function public.utw_stat_season_report(text) from public,anon,authenticated;
grant execute on function public.utw_stat_season_report(text) to service_role;
