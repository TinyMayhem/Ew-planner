-- UTW R4 private, read-only member performance report aggregation.
-- No additional public database read access is granted.
CREATE OR REPLACE FUNCTION public.utw_stat_member_report_data(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_season text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with active as materialized (
    select distinct on (i.season_id,i.metric,i.period)
      i.id, i.season_id, i.metric, i.period, i.row_count
    from public.utw_stat_imports i
    where (p_from is null or i.period >= p_from)
      and (p_to is null or i.period <= p_to)
      and (p_season is null or i.season_id = p_season)
      and i.metric in ('vs_daily','vs_weekly','donations_weekly')
    order by i.season_id, i.metric, i.period, i.created_at desc, i.id desc
  ),
  observed as materialized (
    select i.id as import_id, a.member_id, max(v.points) as points
    from active i
    join public.utw_stat_values v on v.import_id=i.id
    join public.utw_stat_aliases a on a.alias_key=v.alias_key
    group by i.id, a.member_id
  ),
  latest_vs as (
    select i.id, i.period
    from public.utw_stat_imports i
    where i.metric in ('vs_daily','vs_weekly')
      and (p_to is null or i.period <= p_to)
      and (p_season is null or i.season_id = p_season)
    order by i.period desc, i.created_at desc, i.id desc
    limit 1
  ),
  current_roster as (
    select distinct a.member_id
    from latest_vs li
    join public.utw_stat_values v on v.import_id=li.id
    join public.utw_stat_aliases a on a.alias_key=v.alias_key
  )
  select jsonb_build_object(
    'members',coalesce((
      select jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name)
      order by m.display_name)
      from public.utw_stat_members m
    ),'[]'::jsonb),
    'snapshots',coalesce((
      select jsonb_agg(jsonb_build_object('id',i.id,'date',i.period,
        'metric',i.metric,'season',i.season_id,'rowCount',i.row_count)
        order by i.period,i.metric,i.season_id)
      from active i
    ),'[]'::jsonb),
    'observations',coalesce((
      select jsonb_agg(jsonb_build_object('snapshotId',o.import_id,
        'memberId',o.member_id,'points',o.points))
      from observed o
    ),'[]'::jsonb),
    'roster',coalesce((
      select jsonb_agg(r.member_id) from current_roster r
    ),'[]'::jsonb),
    'rosterDate',(select li.period from latest_vs li limit 1)
  );
$function$

REVOKE ALL ON FUNCTION public.utw_stat_member_report_data(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.utw_stat_member_report_data(date,date,text) TO service_role;
