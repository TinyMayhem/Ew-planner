-- Reviewed full Desert Storm team leaderboards, separate from legacy podium uploads.
-- No scoreboard is invented for a missing Team A / Team B upload.
create table if not exists public.utw_ds_team_rankings (
 id uuid primary key default gen_random_uuid(),
 season_id text not null references public.utw_stat_seasons(id),
 event_date date not null,
 team text not null check(team in ('a','b')),
 rows jsonb not null default '[]'::jsonb check (jsonb_typeof(rows)='array'),
 revision integer not null default 0 check(revision>=0),
 updated_by text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(season_id,event_date,team)
);
create index if not exists utw_ds_team_rankings_date_idx
 on public.utw_ds_team_rankings(event_date desc,season_id,team);
create table if not exists public.utw_ds_team_changes (
 id bigint generated always as identity primary key,
 ranking_id uuid not null references public.utw_ds_team_rankings(id) on delete cascade,
 season_id text not null,
 event_date date not null,
 team text not null,
 action text not null check(action in ('append','replace')),
 before_rows jsonb not null default '[]'::jsonb,
 after_rows jsonb not null default '[]'::jsonb,
 actor text not null,
 created_at timestamptz not null default now()
);
create index if not exists utw_ds_team_changes_ranking_idx
 on public.utw_ds_team_changes(ranking_id,id desc);
alter table public.utw_ds_team_rankings enable row level security;
alter table public.utw_ds_team_changes enable row level security;
revoke all on public.utw_ds_team_rankings,public.utw_ds_team_changes from anon,authenticated;
revoke all on sequence public.utw_ds_team_changes_id_seq from anon,authenticated;
grant select,insert,update,delete on public.utw_ds_team_rankings,public.utw_ds_team_changes to service_role;
grant usage,select on sequence public.utw_ds_team_changes_id_seq to service_role;

-- Atomic, revision-checked save. Other R4s' updates cannot be overwritten
-- silently, and a member cannot be assigned to both teams on the same date.
create or replace function public.utw_ds_team_apply(
 p_season text,p_date date,p_team text,p_mode text,
 p_rows jsonb,p_revision integer,p_actor text
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
 rec public.utw_ds_team_rankings%rowtype;
 other_rows jsonb;
 original_rows jsonb;
 combined jsonb;
 item jsonb;
 mid uuid;
 points bigint;
 seen uuid[]:=array[]::uuid[];
 count_rows integer;
begin
 if p_team not in ('a','b') or p_mode not in ('append','replace')
   or p_date is null or length(trim(p_actor))<2 or length(p_actor)>80
   or jsonb_typeof(p_rows)<>'array' then
   raise exception 'Choose a valid Desert Storm date, team, and upload method';
 end if;
 count_rows:=jsonb_array_length(p_rows);
 if count_rows<1 or count_rows>200 then raise exception 'Review 1 to 200 ranked players'; end if;
 select * into rec from public.utw_ds_team_rankings
  where season_id=p_season and event_date=p_date and team=p_team for update;
 if found then
  if rec.revision<>p_revision then
   raise exception 'Team results changed since you opened them. Refresh and retry.';
  end if;
  original_rows:=rec.rows;
 else
  if coalesce(p_revision,0)<>0 then raise exception 'Team results changed since you opened them. Refresh and retry.'; end if;
  original_rows:='[]'::jsonb;
  insert into public.utw_ds_team_rankings(season_id,event_date,team,updated_by)
   values(p_season,p_date,p_team,p_actor) returning * into rec;
 end if;
 combined:=case when p_mode='replace' then '[]'::jsonb else original_rows end;
 for item in select value from jsonb_array_elements(p_rows) loop
  begin
   mid:=(item->>'member_id')::uuid;
   points:=(item->>'points')::bigint;
  exception when others then raise exception 'Invalid DS member ID or score';
  end;
  if points<0 or points>9007199254740991 or mid=any(seen) then raise exception 'Duplicate DS player or invalid nonnegative score'; end if;
  if not exists(select 1 from public.utw_stat_members where id=mid) then raise exception 'Unknown DS roster member'; end if;
  seen:=array_append(seen,mid);
  -- A reviewed re-upload replaces that member's old score, not adds another score.
  select coalesce(jsonb_agg(v),'[]'::jsonb) into combined
  from jsonb_array_elements(combined) v where v->>'member_id'<>mid::text;
  combined:=combined||jsonb_build_array(jsonb_build_object('member_id',mid,'points',points));
 end loop;
 -- An R4 typo must not silently count a member on two different teams.
 select coalesce(other.rows,'[]'::jsonb) into other_rows
  from public.utw_ds_team_rankings other
  where other.season_id=p_season and other.event_date=p_date and other.team<>p_team;
 if exists(
  select 1 from jsonb_array_elements(combined) a
   join jsonb_array_elements(other_rows) b on a->>'member_id'=b->>'member_id'
 ) then raise exception 'One or more players are already recorded on the opposite DS team for this date'; end if;
 update public.utw_ds_team_rankings
 set rows=combined,revision=revision+1,updated_by=p_actor,updated_at=now()
 where id=rec.id;
 insert into public.utw_ds_team_changes(ranking_id,season_id,event_date,team,action,before_rows,after_rows,actor)
 values(rec.id,p_season,p_date,p_team,p_mode,original_rows,combined,p_actor);
 return jsonb_build_object('ok',true,'id',rec.id,'revision',rec.revision+1,
  'team',p_team,'event_date',p_date,'count',jsonb_array_length(combined));
end;$$;
revoke all on function public.utw_ds_team_apply(text,date,text,text,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.utw_ds_team_apply(text,date,text,text,jsonb,integer,text) to service_role;