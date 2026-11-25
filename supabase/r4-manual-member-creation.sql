-- Atomic roster creation; callable only by the server's service role.
create or replace function public.utw_create_members(
 p_members jsonb, p_aliases jsonb, p_actor text, p_actor_id uuid
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
 v_count integer;
begin
 if jsonb_typeof(p_members) is distinct from 'array' or jsonb_typeof(p_aliases) is distinct from 'array' then
  raise exception 'Invalid roster batch';
 end if;
 v_count := jsonb_array_length(p_members);
 if v_count < 1 or v_count > 100 or jsonb_array_length(p_aliases) < v_count or jsonb_array_length(p_aliases) > v_count * 11 then
  raise exception 'Invalid roster batch size';
 end if;
 if exists (
  select 1 from jsonb_to_recordset(p_aliases) a(alias_key text, alias text, member_id uuid)
  where not exists (select 1 from jsonb_to_recordset(p_members) m(id uuid, display_name text) where m.id=a.member_id)
 ) or exists (
  select 1 from jsonb_to_recordset(p_members) m(id uuid, display_name text)
  where not exists (select 1 from jsonb_to_recordset(p_aliases) a(alias_key text, alias text, member_id uuid) where a.member_id=m.id and a.alias=m.display_name)
 ) then raise exception 'Each new member needs a main name and matching aliases'; end if;
 insert into public.utw_stat_members(id,display_name)
 select id,display_name from jsonb_to_recordset(p_members) as m(id uuid,display_name text);
 insert into public.utw_stat_aliases(alias_key,alias,member_id)
 select alias_key,alias,member_id from jsonb_to_recordset(p_aliases) as a(alias_key text,alias text,member_id uuid);
 insert into public.utw_stat_audit(action,details,actor,actor_id,reversible)
 values ('create_members',jsonb_build_object('members',p_members,'aliases',p_aliases,'count',v_count),p_actor,p_actor_id,false);
 return jsonb_build_object('ok',true,'count',v_count,'members',p_members);
end;
$$;
revoke all on function public.utw_create_members(jsonb,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.utw_create_members(jsonb,jsonb,text,uuid) to service_role;
