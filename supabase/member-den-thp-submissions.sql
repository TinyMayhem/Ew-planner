-- Private Members Den THP submissions with atomic R4 review.
-- Only the server's service-role key may access these tables and RPC.
create table if not exists public.utw_thp_submissions (
 id uuid primary key default gen_random_uuid(),
 submitted_name text not null check (char_length(submitted_name) between 1 and 100),
 squad_type text not null check (squad_type in ('tank','air','missile')),
 squad_power bigint not null check (squad_power >= 0 and squad_power <= 9007199254740991),
 hero_power bigint not null check (hero_power > 0 and hero_power <= 9007199254740991),
 measurement_date date not null default (now() at time zone 'America/Noronha')::date,
 evidence_path text,
 member_note text not null default '' check (char_length(member_note) <= 500),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by text,
 review_note text,
 approved_source_member_id text,
 approved_member_name text,
 approved_hero_power bigint,
 approved_squad_type text,
 approved_squad_power bigint,
 constraint utw_thp_review_fields check (
  (status='pending' and reviewed_at is null)
  or (status<>'pending' and reviewed_at is not null)
 )
);
create index if not exists utw_thp_queue_created on public.utw_thp_submissions(status,submitted_at desc);
create index if not exists utw_thp_name_date on public.utw_thp_submissions(lower(submitted_name),measurement_date desc);
alter table public.utw_thp_submissions enable row level security;
revoke all on table public.utw_thp_submissions from public,anon,authenticated;
grant select,insert,update on table public.utw_thp_submissions to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('utw-thp-evidence','utw-thp-evidence',false,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=3145728,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- A single database transaction writes approval, historical THP, squad data and audit.
create or replace function public.utw_review_member_thp(
 p_id uuid, p_decision text, p_member_id text default null,
 p_hero_power bigint default null, p_squad_type text default null,
 p_squad_power bigint default null, p_reviewer text default null,
 p_note text default ''
) returns public.utw_thp_submissions
language plpgsql security invoker
set search_path = ''
as $function$
declare
 v public.utw_thp_submissions%rowtype;
 player_name text;
 previous_thp bigint;
 previous_date date;
 old_squad jsonb;
begin
 select * into v from public.utw_thp_submissions where id=p_id for update;
 if not found then raise exception 'Submission not found'; end if;
 if v.status <> 'pending' then raise exception 'Submission already reviewed'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
 if coalesce(char_length(trim(p_reviewer)),0) not between 1 and 80 then
  raise exception 'Reviewer required';
 end if;
 if char_length(coalesce(p_note,''))>500 then raise exception 'Review note too long'; end if;
 if p_decision='approved' then
  if p_member_id is null or p_member_id !~ '^[A-Za-z0-9_-]{1,100}$'
    or p_hero_power is null or p_hero_power<=0 or p_hero_power>9007199254740991
    or p_squad_type not in ('tank','air','missile')
    or p_squad_power is null or p_squad_power<0 or p_squad_power>9007199254740991 then
   raise exception 'Select a valid member, Hero Power and squad';
  end if;
  select name into player_name from public.utw_duel_backup_members
   where source_member_id=p_member_id;
  if player_name is null then raise exception 'Member is missing from verified Alliance Duel roster'; end if;
  select h.recorded_on,h.thp into previous_date,previous_thp
   from public.utw_r4_member_thp_history h
   where h.source_member_id=p_member_id
   order by h.recorded_on desc limit 1;
  if previous_date>v.measurement_date then
   raise exception 'A newer THP measurement already exists; reject this older submission and request a fresh one';
  end if;
  select to_jsonb(s) into old_squad
   from public.utw_r4_member_squad_profiles s where s.source_member_id=p_member_id;

  insert into public.utw_r4_member_thp_history
    (source_member_id,recorded_on,member_name,thp,entry_source,updated_at,updated_by)
  values(p_member_id,v.measurement_date,player_name,p_hero_power,
    'member submission approved by R4',now(),p_reviewer)
  on conflict(source_member_id,recorded_on) do update set
    member_name=excluded.member_name,thp=excluded.thp,entry_source=excluded.entry_source,
    updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  insert into public.utw_r4_member_squad_profiles
    (source_member_id,member_name,squad_type,squad_power,updated_at,updated_by)
  values(p_member_id,player_name,p_squad_type,p_squad_power,now(),p_reviewer)
  on conflict(source_member_id) do update set
    member_name=excluded.member_name,squad_type=excluded.squad_type,
    squad_power=excluded.squad_power,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 end if;
 update public.utw_thp_submissions set status=p_decision,reviewed_at=now(),
  reviewed_by=p_reviewer,review_note=coalesce(p_note,''),
  approved_source_member_id=case when p_decision='approved' then p_member_id else null end,
  approved_member_name=case when p_decision='approved' then player_name else null end,
  approved_hero_power=case when p_decision='approved' then p_hero_power else null end,
  approved_squad_type=case when p_decision='approved' then p_squad_type else null end,
  approved_squad_power=case when p_decision='approved' then p_squad_power else null end
 where id=p_id returning * into v;
 insert into public.utw_stat_audit(action,actor,details,reversible)
 values('member_thp_submission_'||p_decision,p_reviewer,jsonb_build_object(
  'submission_id',p_id,'submitted_name',v.submitted_name,
  'recorded_on',v.measurement_date,'source_member_id',p_member_id,
  'previous_thp',previous_thp,'previous_thp_date',previous_date,
  'previous_squad',old_squad,
  'approved_thp',p_hero_power,'squad_type',p_squad_type,'squad_power',p_squad_power,
  'review_note',p_note),false);
 return v;
end
$function$;
revoke all on function public.utw_review_member_thp(uuid,text,text,bigint,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.utw_review_member_thp(uuid,text,text,bigint,text,bigint,text,text) to service_role;
