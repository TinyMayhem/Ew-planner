
-- UTW R4 private poll intentions. NOT a record of verified attendance.
-- All access is through R4-authenticated Vercel server functions, never a public client key.
create table if not exists public.utw_poll_events (
 id uuid primary key default gen_random_uuid(),
 event_type text not null check(event_type in ('svs','trade_post','wednesday_war','saturday_war')),
 event_date date not null,
 title text not null check(length(title) between 1 and 120),
 status text not null default 'draft' check(status in ('draft','review','finalized')),
 roster jsonb not null default '[]'::jsonb check(jsonb_typeof(roster)='array'),
 roster_date date,
 roster_source text not null default 'Saved VS roster',
 reviewed_yes boolean not null default false,
 reviewed_no boolean not null default false,
 reviewed_maybe boolean not null default false,
 revision integer not null default 0 check(revision>=0),
 created_by text not null,
 updated_by text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(event_type,event_date,title)
);
create index if not exists utw_poll_events_date_idx on public.utw_poll_events(event_date desc,created_at desc);
create table if not exists public.utw_poll_votes (
 poll_id uuid not null references public.utw_poll_events(id) on delete cascade,
 member_id uuid not null references public.utw_stat_members(id) on delete restrict,
 response text not null check(response in ('yes','no','maybe')),
 source text not null check(source in ('screenshot','csv','manual')),
 note text not null default '' check(length(note)<=500),
 updated_by text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(poll_id,member_id)
);
create index if not exists utw_poll_votes_member_idx on public.utw_poll_votes(member_id);
create table if not exists public.utw_poll_changes (
 id bigint generated always as identity primary key,
 poll_id uuid not null references public.utw_poll_events(id) on delete cascade,
 member_id uuid references public.utw_stat_members(id) on delete set null,
 action text not null,
 old_response text,
 new_response text,
 details jsonb not null default '{}'::jsonb,
 actor text not null,
 created_at timestamptz not null default now()
);
create index if not exists utw_poll_changes_poll_idx on public.utw_poll_changes(poll_id,id desc);
alter table public.utw_poll_events enable row level security;
alter table public.utw_poll_votes enable row level security;
alter table public.utw_poll_changes enable row level security;
revoke all on public.utw_poll_events,public.utw_poll_votes,public.utw_poll_changes from anon,authenticated;
revoke all on public.utw_poll_changes_id_seq from anon,authenticated;
grant select,insert,update,delete on public.utw_poll_events,public.utw_poll_votes,public.utw_poll_changes to service_role;
grant usage,select on sequence public.utw_poll_changes_id_seq to service_role;

-- Atomic version-checked updates avoid two R4s silently overwriting each other.
create or replace function public.utw_poll_change(p_poll_id uuid,p_revision integer,p_operation text,p_payload jsonb,p_actor text)
returns jsonb language plpgsql security invoker set search_path = public
as $$
declare
 e public.utw_poll_events%rowtype;
 item jsonb;
 category text;
 mode text;
 r text;
 src text;
 mid uuid;
 old_vote public.utw_poll_votes%rowtype;
 exists_vote boolean;
 roster_entry jsonb;
 new_roster jsonb;
 review_flag boolean;
 seen uuid[] := array[]::uuid[];
 num integer;
begin
 if p_actor is null or length(trim(p_actor))<2 or length(p_actor)>80 then raise exception 'Valid R4 actor required'; end if;
 select * into e from public.utw_poll_events where id=p_poll_id for update;
 if not found then raise exception 'Poll not found'; end if;
 if e.revision<>p_revision then raise exception 'Poll changed since your last refresh. Reload and try again.'; end if;
 if p_operation='votes' then
  category:=lower(coalesce(p_payload->>'response',''));
  mode:=coalesce(p_payload->>'mode','append');
  if category not in ('yes','no','maybe') or mode not in ('append','replace','manual') then raise exception 'Invalid voting category or upload mode'; end if;
  if jsonb_typeof(p_payload->'items')<>'array' then raise exception 'Expected reviewed member rows'; end if;
  num:=jsonb_array_length(p_payload->'items');
  if num>250 or (num=0 and mode<>'replace') then raise exception 'Choose between 1 and 250 reviewed names'; end if;
  if mode='replace' then
   for old_vote in select * from public.utw_poll_votes where poll_id=p_poll_id and response=category and source<>'manual' loop
    insert into public.utw_poll_changes(poll_id,member_id,action,old_response,details,actor)
    values(p_poll_id,old_vote.member_id,'replace_removed',old_vote.response,jsonb_build_object('old_source',old_vote.source),p_actor);
   end loop;
   delete from public.utw_poll_votes where poll_id=p_poll_id and response=category and source<>'manual';
  end if;
  for item in select value from jsonb_array_elements(p_payload->'items') loop
   begin mid:=(item->>'member_id')::uuid; exception when others then raise exception 'Unknown member in reviewed rows'; end;
   if mid=any(seen) then raise exception 'Duplicate member in this upload'; end if;
   seen:=array_append(seen,mid);
   if not exists(select 1 from jsonb_array_elements(e.roster) z where z->>'id'=mid::text) then
    raise exception 'Member is not in this poll roster. Add them to eligibility first.';
   end if;
   src:=coalesce(item->>'source',case when mode='manual' then 'manual' else 'screenshot' end);
   if src not in ('screenshot','csv','manual') then raise exception 'Invalid source'; end if;
   select * into old_vote from public.utw_poll_votes where poll_id=p_poll_id and member_id=mid;
   exists_vote:=found;
   if exists_vote and old_vote.response<>category and mode<>'manual' then
    raise exception 'Member appears in different response category. Review the existing vote first.';
   end if;
   if exists_vote and old_vote.response=category and old_vote.source='manual' and mode<>'manual' then
    continue; -- late manual corrections survive a screenshot replacement
   end if;
   insert into public.utw_poll_votes(poll_id,member_id,response,source,note,updated_by)
   values(p_poll_id,mid,category,src,left(coalesce(item->>'note',''),500),p_actor)
   on conflict(poll_id,member_id) do update set
    response=excluded.response,source=excluded.source,note=excluded.note,updated_by=excluded.updated_by,updated_at=now();
   if not exists_vote or old_vote.response<>category or old_vote.source<>src or old_vote.note<>left(coalesce(item->>'note',''),500) then
    insert into public.utw_poll_changes(poll_id,member_id,action,old_response,new_response,details,actor)
    values(p_poll_id,mid,case when mode='manual' then 'manual_vote' else 'uploaded_vote' end,
     case when exists_vote then old_vote.response else null end,category,
     jsonb_build_object('source',src,'note',left(coalesce(item->>'note',''),500)),p_actor);
   end if;
  end loop;
  -- A new upload requires the category to be reviewed again. Manual late
  -- responses leave finalized polling intact, but remain visible in history.
  if mode<>'manual' then
   if category='yes' then update public.utw_poll_events set reviewed_yes=false,status='review' where id=p_poll_id;
   elsif category='no' then update public.utw_poll_events set reviewed_no=false,status='review' where id=p_poll_id;
   else update public.utw_poll_events set reviewed_maybe=false,status='review' where id=p_poll_id; end if;
  end if;
 elsif p_operation='review' then
  category:=lower(coalesce(p_payload->>'category',''));
  review_flag:=coalesce((p_payload->>'reviewed')::boolean,false);
  if category='yes' then update public.utw_poll_events set reviewed_yes=review_flag where id=p_poll_id;
  elsif category='no' then update public.utw_poll_events set reviewed_no=review_flag where id=p_poll_id;
  elsif category='maybe' then update public.utw_poll_events set reviewed_maybe=review_flag where id=p_poll_id;
  else raise exception 'Unknown review category'; end if;
  if not review_flag then update public.utw_poll_events set status='review' where id=p_poll_id; end if;
  insert into public.utw_poll_changes(poll_id,action,details,actor) values(p_poll_id,'review',jsonb_build_object('category',category,'reviewed',review_flag),p_actor);
 elsif p_operation='finalize' then
  select * into e from public.utw_poll_events where id=p_poll_id;
  if not(e.reviewed_yes and e.reviewed_no and e.reviewed_maybe) then raise exception 'Review Yes, No and Maybe lists before finalizing'; end if;
  if jsonb_array_length(e.roster)=0 then raise exception 'Add a VS roster before finalizing'; end if;
  update public.utw_poll_events set status='finalized' where id=p_poll_id;
  insert into public.utw_poll_changes(poll_id,action,details,actor) values(p_poll_id,'finalize','{}'::jsonb,p_actor);
 elsif p_operation='remove_vote' then
  begin mid:=(p_payload->>'member_id')::uuid; exception when others then raise exception 'Choose a valid member vote'; end;
  select * into old_vote from public.utw_poll_votes where poll_id=p_poll_id and member_id=mid;
  if not found then raise exception 'That vote no longer exists'; end if;
  delete from public.utw_poll_votes where poll_id=p_poll_id and member_id=mid;
  insert into public.utw_poll_changes(poll_id,member_id,action,old_response,details,actor)
    values(p_poll_id,mid,'remove_vote',old_vote.response,jsonb_build_object('reason',left(coalesce(p_payload->>'reason','Erroneous entry'),500),'source',old_vote.source),p_actor);
 elsif p_operation='eligibility' then
  category:=coalesce(p_payload->>'mode','');
  begin mid:=(p_payload->>'member_id')::uuid; exception when others then raise exception 'Invalid member'; end;
  select to_jsonb(m) into roster_entry from (
   select id,display_name as name from public.utw_stat_members where id=mid
  ) m;
  if roster_entry is null then raise exception 'Member not found'; end if;
  if category='add' then
   if not exists(select 1 from jsonb_array_elements(e.roster) z where z->>'id'=mid::text) then
    new_roster:=e.roster||jsonb_build_array(roster_entry);
    update public.utw_poll_events set roster=new_roster where id=p_poll_id;
   end if;
  elsif category='remove' then
   select coalesce(jsonb_agg(z),'[]'::jsonb) into new_roster
    from jsonb_array_elements(e.roster) z where z->>'id'<>mid::text;
   update public.utw_poll_events set roster=new_roster where id=p_poll_id;
  else raise exception 'Eligibility action must be add or remove'; end if;
  insert into public.utw_poll_changes(poll_id,member_id,action,details,actor)
   values(p_poll_id,mid,'eligibility',jsonb_build_object('mode',category),p_actor);
 else raise exception 'Unsupported poll operation'; end if;
 update public.utw_poll_events
  set revision=revision+1,updated_at=now(),updated_by=p_actor,
   status=case when p_operation in ('votes','eligibility') and status='draft' then 'review' else status end
 where id=p_poll_id;
 return (select jsonb_build_object('ok',true,'revision',revision,'status',status)
  from public.utw_poll_events where id=p_poll_id);
end;$$;
revoke all on function public.utw_poll_change(uuid,integer,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.utw_poll_change(uuid,integer,text,jsonb,text) to service_role;
