-- UTW Train Desk: one conductor and one VIP per dated train assignment.
-- VIP stays nullable to preserve any conductor-only historical records.
alter table public.utw_stat_awards
 add column if not exists vip_member_id uuid references public.utw_stat_members(id);

create index if not exists utw_stat_awards_vip_member_idx
 on public.utw_stat_awards(vip_member_id,train_date desc);

do $$
begin
 if not exists (
  select 1 from pg_constraint
   where conname='utw_stat_awards_distinct_people'
    and conrelid='public.utw_stat_awards'::regclass
 ) then
  alter table public.utw_stat_awards
   add constraint utw_stat_awards_distinct_people
   check (vip_member_id is null or vip_member_id<>member_id);
 end if;
end $$;

-- Preserve historical train associations when merging changed in-game names.
create or replace function public.utw_stat_merge_members(p_source uuid,p_target uuid)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare source_name text;
begin
 if p_source=p_target then raise exception 'Choose two different members'; end if;
 select display_name into source_name from public.utw_stat_members where id=p_source for update;
 if not found then raise exception 'Source member not found'; end if;
 perform 1 from public.utw_stat_members where id=p_target for update;
 if not found then raise exception 'Target member not found'; end if;
 update public.utw_stat_aliases set member_id=p_target where member_id=p_source;
 update public.utw_stat_ds set first_member=p_target where first_member=p_source;
 update public.utw_stat_ds set second_member=p_target where second_member=p_source;
 update public.utw_stat_ds set third_member=p_target where third_member=p_source;
 update public.utw_stat_awards
  set vip_member_id=case when vip_member_id=p_target then null else vip_member_id end
  where member_id=p_source;
 update public.utw_stat_awards set member_id=p_target where member_id=p_source;
 update public.utw_stat_awards
  set vip_member_id=case when member_id=p_target then null else p_target end
  where vip_member_id=p_source;
 update public.utw_stat_exceptions set member_id=p_target where member_id=p_source;
 insert into public.utw_stat_audit(action,details)
  values('merge_members',jsonb_build_object('source_id',p_source,'source_name',source_name,'target_id',p_target));
 delete from public.utw_stat_members where id=p_source;
end $$;
revoke all on function public.utw_stat_merge_members(uuid,uuid) from public,anon,authenticated;
grant execute on function public.utw_stat_merge_members(uuid,uuid) to service_role;

alter table public.utw_stat_awards enable row level security;
revoke all on public.utw_stat_awards from public,anon,authenticated;
grant select,insert,update,delete on public.utw_stat_awards to service_role;
