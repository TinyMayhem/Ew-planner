-- R4 owner audit history. Passwords, sessions and account credentials are never logged.
alter table public.utw_stat_audit
 add column if not exists actor text not null default 'Shared R4 / unattributed',
 add column if not exists actor_id uuid,
 add column if not exists reversible boolean not null default false,
 add column if not exists undone_at timestamptz,
 add column if not exists undone_by text;

create index if not exists utw_stat_audit_recent_idx on public.utw_stat_audit(created_at desc);

-- Called only by the server after checking an active personal owner/admin session.
-- A single database transaction locks the audit entry and either fully undoes it or fails.
create or replace function public.utw_stat_undo_audit_entry(p_audit_id bigint,p_actor text)
returns text
language plpgsql security invoker
set search_path=public,pg_temp
as $$
declare
 a public.utw_stat_audit%rowtype;
 d jsonb;
 record_id uuid;
 restored int;
begin
 select * into a from public.utw_stat_audit where id=p_audit_id for update;
 if not found then raise exception 'Audit entry not found'; end if;
 if not a.reversible or a.undone_at is not null then raise exception 'This entry cannot be undone'; end if;
 if p_actor is null or char_length(btrim(p_actor))<1 or char_length(p_actor)>80 then raise exception 'Invalid actor'; end if;
 d:=a.details;
 case a.action
  when 'import' then
   record_id:=(d->>'id')::uuid;
   delete from public.utw_stat_imports where id=record_id;
   get diagnostics restored=row_count;
   if restored<>1 then raise exception 'Import was already removed'; end if;
  when 'delete_import' then
   if d->'row' is null or d->'values' is null then raise exception 'Missing import backup'; end if;
   insert into public.utw_stat_imports
    select (jsonb_populate_record(null::public.utw_stat_imports,d->'row')).*;
   insert into public.utw_stat_values(import_id,alias_key,original_name,points)
    select ((d->'row')->>'id')::uuid, x.alias_key,x.original_name,x.points
    from jsonb_to_recordset(d->'values') as x(alias_key text,original_name text,points bigint);
  when 'award' then
   delete from public.utw_stat_awards where id=(d->>'id')::uuid;
   get diagnostics restored=row_count;
   if restored<>1 then raise exception 'Train assignment has already changed'; end if;
  when 'delete_award' then
   if d->'row' is null then raise exception 'Missing train backup'; end if;
   insert into public.utw_stat_awards
    select (jsonb_populate_record(null::public.utw_stat_awards,d->'row')).*;
  when 'ds' then
   delete from public.utw_stat_ds where id=(d->>'id')::uuid;
   get diagnostics restored=row_count;
   if restored<>1 then raise exception 'DS result has already changed'; end if;
  when 'delete_ds' then
   if d->'row' is null then raise exception 'Missing DS backup'; end if;
   insert into public.utw_stat_ds
    select (jsonb_populate_record(null::public.utw_stat_ds,d->'row')).*;
  when 'alias' then
   delete from public.utw_stat_aliases where alias_key=d->>'alias_key' and member_id=(d->>'member_id')::uuid;
   get diagnostics restored=row_count;
   if restored<>1 then raise exception 'Nickname is no longer in the original state'; end if;
  when 'exception' then
   delete from public.utw_stat_exceptions where id=(d->>'id')::uuid;
   get diagnostics restored=row_count;
   if restored<>1 then raise exception 'Exception was already removed'; end if;
  when 'clear_exception' then
   update public.utw_stat_exceptions set active=true where id=(d->>'id')::uuid and active=false;
   get diagnostics restored=row_count;
   if restored<>1 then raise exception 'Exception has already changed'; end if;
  else raise exception 'This type of change does not support undo';
 end case;
 update public.utw_stat_audit set undone_at=now(),undone_by=p_actor where id=p_audit_id;
 insert into public.utw_stat_audit(action,details,actor,reversible)
 values ('undo',jsonb_build_object('original_audit_id',p_audit_id,'original_action',a.action),p_actor,false);
 return 'Undone: '||a.action;
end $$;
revoke all on function public.utw_stat_undo_audit_entry(bigint,text) from public,anon,authenticated;
grant execute on function public.utw_stat_undo_audit_entry(bigint,text) to service_role;
