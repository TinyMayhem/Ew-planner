-- Devi review service. Initial intake paused pending deployment smoke tests.
begin;
create table public.devi_settings(id integer primary key check(id=1), paused boolean not null default true, max_queue integer not null default 20 check(max_queue between 1 and 500));
insert into public.devi_settings(id) values(1);
create table public.devi_reviews(
 id uuid primary key default gen_random_uuid(), code_hash text unique not null, ign text not null, server text not null, tier text not null check(tier in ('Squad Check','Growth Plan','Full Account Strategy')), squad_count int not null check(squad_count between 1 and 4), squad_types jsonb not null default '[]', goals text not null default '', spending text not null default '', method text not null check(method in ('upload','ingame')), pvp_confirmed boolean not null default false,
 terms_version text, terms_accepted_at timestamptz, status text not null default 'intake' check(status in ('intake','submitted','awaiting_payment','awaiting_screenshots','in_progress','completed','abandoned')), paid boolean not null default false, protected boolean not null default false, private_notes text not null default '', created_at timestamptz not null default now(), activity_at timestamptz not null default now(), completed_at timestamptz, report_published_at timestamptz, feedback text, feedback_publish boolean not null default false,
 check(status not in ('in_progress','completed') or (paid and terms_accepted_at is not null and terms_version is not null)),
 check(squad_count<=case tier when 'Squad Check' then 1 when 'Growth Plan' then 2 else 4 end));
create table public.devi_files(id uuid primary key default gen_random_uuid(), review_id uuid not null references public.devi_reviews(id), kind text not null check(kind in ('screenshot','report')), squad integer, slot integer, path text not null unique, label text not null, mime text not null, reserved_bytes bigint not null check(reserved_bytes between 12 and 52428800), state text not null default 'pending' check(state in ('pending','ready','published','retired','deleting','deleted')), created_at timestamptz not null default now(), expires_at timestamptz, check((kind='screenshot' and squad is not null and slot is not null and squad between 1 and 4 and slot between 1 and 15) or (kind='report' and squad is null and slot is null)));
create unique index devi_screenshot_slot on public.devi_files(review_id,squad,slot) where kind='screenshot' and state in ('pending','ready','deleting');
create unique index devi_one_report on public.devi_files(review_id) where kind='report' and state='published';
create table public.devi_messages(id uuid primary key default gen_random_uuid(), review_id uuid not null references public.devi_reviews(id), sender text not null check(sender in ('customer','admin')), body text not null check(length(body) between 1 and 3000), created_at timestamptz not null default now());
create table public.devi_tasks(id uuid primary key default gen_random_uuid(), review_id uuid not null references public.devi_reviews(id), label text not null check(length(label) between 1 and 500), priority text not null check(priority in ('Immediate','Next','Long-term','Do not invest yet')), done boolean not null default false, position int not null default 0);
create index devi_reviews_status on public.devi_reviews(status,activity_at);
create index devi_files_expiry on public.devi_files(expires_at) where state<>'deleted';
create index devi_messages_review on public.devi_messages(review_id,created_at);
create index devi_tasks_review on public.devi_tasks(review_id,position);
do $$ declare t text; begin foreach t in array array['devi_settings','devi_reviews','devi_files','devi_messages','devi_tasks'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from public,anon,authenticated',t); execute format('grant select,insert,update,delete on public.%I to service_role',t); end loop; end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('devi-private','devi-private',false,52428800,array['image/jpeg','image/png','image/webp','application/pdf']);
create function public.devi_create(p_data jsonb,p_manual boolean default false) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.devi_settings; n int; new_id uuid; begin
 perform pg_advisory_xact_lock(13950061);
 select * into s from public.devi_settings where id=1 for update;
 select count(*) into n from public.devi_reviews where status not in ('completed','abandoned');
 if not p_manual and p_data->>'terms_version' is distinct from '2026-11-25-v1' then raise exception 'Customer terms required'; end if;
 if not p_manual and (s.paused or n>=s.max_queue) then raise exception 'Queue closed'; end if;
 insert into public.devi_reviews(code_hash,ign,server,tier,squad_count,squad_types,goals,spending,method,pvp_confirmed,terms_version,terms_accepted_at,status) values(p_data->>'code_hash',p_data->>'ign',p_data->>'server',p_data->>'tier',(p_data->>'squad_count')::int,p_data->'squad_types',p_data->>'goals',p_data->>'spending',p_data->>'method',(p_data->>'pvp_confirmed')::boolean,p_data->>'terms_version',case when p_data->>'terms_version' is not null then now() else null end,case when p_data->>'method'='ingame' then 'submitted' else 'intake' end) returning id into new_id;
 return new_id; end $$;
create function public.devi_reserve_file(p_data jsonb) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.devi_reviews; n bigint; bytes bigint; f uuid; kind text; begin
 perform pg_advisory_xact_lock(13950062);
 select * into r from public.devi_reviews where id=(p_data->>'review_id')::uuid for update;
 if not found then raise exception 'Review not found'; end if;
 bytes=(p_data->>'bytes')::bigint; kind=p_data->>'kind';
 if kind='screenshot' and (r.status not in ('intake','submitted','awaiting_screenshots','awaiting_payment') or (p_data->>'squad')::int not between 1 and r.squad_count or bytes>3145728) then raise exception 'Screenshot not allowed'; end if;
 if kind='report' and (not r.paid or r.status not in ('in_progress','completed') or r.terms_accepted_at is null or bytes<>52428800) then raise exception 'Report not allowed'; end if;
 select coalesce(sum(reserved_bytes),0) into n from public.devi_files where state<>'deleted';
 if n+bytes>600000000 then raise exception 'Service file capacity reached'; end if;
 insert into public.devi_files(review_id,kind,squad,slot,path,label,mime,reserved_bytes,expires_at) values(r.id,kind,(p_data->>'squad')::int,(p_data->>'slot')::int,p_data->>'path',p_data->>'label',p_data->>'mime',bytes,now()+interval '1 day') returning id into f;
 return f; end $$;
create function public.devi_publish(p_review uuid,p_file uuid) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare f public.devi_files; actual bigint; begin
 perform 1 from public.devi_reviews where id=p_review and paid and terms_accepted_at is not null and status in ('in_progress','completed') for update;
 if not found then raise exception 'Payment confirmation, acceptance and review start required'; end if;
 select * into f from public.devi_files where id=p_file and review_id=p_review and kind='report' and state='ready' for update;
 if not found then raise exception 'Report not ready'; end if;
 -- Reserve at the maximum, then shrink reservation only after verified storage metadata.
 select (metadata->>'size')::bigint into actual from storage.objects where bucket_id='devi-private' and name=f.path;
 if actual is null or actual not between 12 and 52428800 then raise exception 'Report storage size invalid'; end if;
 update public.devi_files set state='retired',expires_at=now() where review_id=p_review and kind='report' and state='published';
 update public.devi_files set state='published',expires_at=now()+interval '30 days',reserved_bytes=actual where id=p_file;
 update public.devi_reviews set status='completed',completed_at=coalesce(completed_at,now()),report_published_at=now(),activity_at=now() where id=p_review;
 update public.devi_files set expires_at=coalesce(expires_at,(select completed_at+interval '30 days' from public.devi_reviews where id=p_review)) where review_id=p_review and kind='screenshot' and state='ready';
 end $$;
create function public.devi_queue_count() returns integer language sql security invoker set search_path=public,pg_temp as $$ select count(*)::integer from public.devi_reviews where status not in ('completed','abandoned') $$;
create function public.devi_abandon(p_id uuid,p_activity timestamptz) returns void language plpgsql security invoker set search_path=public,pg_temp as $$ begin
 update public.devi_reviews set status='abandoned' where id=p_id and activity_at=p_activity and not protected and status in ('intake','submitted','awaiting_payment','awaiting_screenshots') and activity_at<now()-interval '30 days';
 if found then update public.devi_files set expires_at=now() where review_id=p_id and state not in ('deleted','retired','deleting'); end if; end $$;
create function public.devi_claim_cleanup() returns table(id uuid,path text) language plpgsql security invoker set search_path=public,pg_temp as $$ begin
 return query with candidates as (
 select f.id from public.devi_files f join public.devi_reviews r on r.id=f.review_id
 where f.state<>'deleted' and f.expires_at<now() and (not r.protected or f.state in ('retired','deleting'))
 order by f.expires_at limit 80 for update of r,f skip locked
 ) update public.devi_files f set state='deleting' from candidates c where f.id=c.id returning f.id,f.path;
 end $$;
revoke all on function public.devi_create(jsonb,boolean),public.devi_reserve_file(jsonb),public.devi_publish(uuid,uuid),public.devi_queue_count(),public.devi_abandon(uuid,timestamptz),public.devi_claim_cleanup() from public,anon,authenticated;
grant execute on function public.devi_create(jsonb,boolean),public.devi_reserve_file(jsonb),public.devi_publish(uuid,uuid),public.devi_queue_count(),public.devi_abandon(uuid,timestamptz),public.devi_claim_cleanup() to service_role;
commit;
