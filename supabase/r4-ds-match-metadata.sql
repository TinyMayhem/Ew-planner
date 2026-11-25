-- Optional match metadata: existing records remain unclassified.
alter table public.utw_ds_team_rankings add column if not exists outcome text check (outcome in ('win','loss'));
alter table public.utw_ds_team_changes add column if not exists before_outcome text check (before_outcome in ('win','loss'));
alter table public.utw_ds_team_changes add column if not exists after_outcome text check (after_outcome in ('win','loss'));
alter table public.utw_stat_ds add column if not exists team text check (team in ('a','b'));
-- Atomic wrapper uses the established score validation and revision control.
create or replace function public.utw_ds_team_apply_outcome(
 p_season text,p_date date,p_team text,p_mode text,p_rows jsonb,p_revision integer,p_actor text,p_outcome text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_prior text;
 v_result jsonb;
 v_id uuid;
begin
 if p_outcome is not null and p_outcome not in ('win','loss') then raise exception 'Invalid match result'; end if;
 select outcome into v_prior from public.utw_ds_team_rankings
 where season_id=p_season and event_date=p_date and team=p_team for update;
 v_result:=public.utw_ds_team_apply(p_season,p_date,p_team,p_mode,p_rows,p_revision,p_actor);
 v_id:=(v_result->>'id')::uuid;
 update public.utw_ds_team_rankings set outcome=coalesce(p_outcome,v_prior) where id=v_id;
 update public.utw_ds_team_changes set before_outcome=v_prior,after_outcome=coalesce(p_outcome,v_prior)
 where id=(select max(id) from public.utw_ds_team_changes where ranking_id=v_id);
 return v_result||jsonb_build_object('outcome',coalesce(p_outcome,v_prior));
end;$$;
revoke all on function public.utw_ds_team_apply_outcome(text,date,text,text,jsonb,integer,text,text) from public,anon,authenticated;
grant execute on function public.utw_ds_team_apply_outcome(text,date,text,text,jsonb,integer,text,text) to service_role;
