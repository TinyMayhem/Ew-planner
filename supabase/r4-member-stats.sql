
-- Private UTW R4 member statistics and train conductor records.
-- Only the server-only Supabase service role receives API table privileges.
create extension if not exists pgcrypto;

create table if not exists public.utw_stat_members (
 id uuid primary key default gen_random_uuid(),
 display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
 created_at timestamptz not null default now()
);
create table if not exists public.utw_stat_aliases (
 alias_key text primary key check (char_length(alias_key) between 1 and 100),
 alias text not null check (char_length(btrim(alias)) between 1 and 100),
 member_id uuid not null references public.utw_stat_members(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists utw_stat_aliases_member_idx on public.utw_stat_aliases(member_id);
create table if not exists public.utw_stat_imports (
 id uuid primary key default gen_random_uuid(),
 metric text not null check (metric in ('vs_daily','vs_weekly','donations_weekly')),
 period date not null,
 filename text not null check (char_length(filename) between 1 and 180),
 file_hash text not null check (char_length(file_hash)=64),
 row_count integer not null check (row_count between 1 and 500),
 created_at timestamptz not null default now(),
 unique(metric,period,file_hash)
);
create index if not exists utw_stat_imports_period_idx on public.utw_stat_imports(period,metric,created_at desc);
create table if not exists public.utw_stat_values (
 id bigint generated always as identity primary key,
 import_id uuid not null references public.utw_stat_imports(id) on delete cascade,
 alias_key text not null references public.utw_stat_aliases(alias_key),
 original_name text not null,
 points bigint not null check(points>=0),
 unique(import_id,alias_key)
);
create index if not exists utw_stat_values_import_idx on public.utw_stat_values(import_id);
create table if not exists public.utw_stat_ds (
 id uuid primary key default gen_random_uuid(),
 event_date date not null,
 opponent text not null default '',
 first_member uuid not null references public.utw_stat_members(id),
 second_member uuid references public.utw_stat_members(id),
 third_member uuid references public.utw_stat_members(id),
 screenshot_path text not null check (char_length(screenshot_path) between 1 and 300),
 notes text not null default '' check (char_length(notes)<=500),
 created_at timestamptz not null default now(),
 check (first_member is distinct from second_member and first_member is distinct from third_member and second_member is distinct from third_member)
);
create index if not exists utw_stat_ds_date_idx on public.utw_stat_ds(event_date desc);
create table if not exists public.utw_stat_exceptions (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.utw_stat_members(id),
 scope text not null check(scope in ('all','ds','donations','vs')),
 starts_on date not null,
 ends_on date not null check(ends_on>=starts_on),
 reason text not null check(char_length(btrim(reason)) between 1 and 300),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create index if not exists utw_stat_exceptions_member_idx on public.utw_stat_exceptions(member_id,active);
create table if not exists public.utw_stat_awards (
 id uuid primary key default gen_random_uuid(),
 train_date date not null,
 slot text not null check(char_length(btrim(slot)) between 1 and 50),
 member_id uuid not null references public.utw_stat_members(id),
 source text not null check(source in ('ds','donations','vs','manual')),
 reason text not null default '' check(char_length(reason)<=500),
 created_at timestamptz not null default now(),
 unique(train_date,slot)
);
create index if not exists utw_stat_awards_member_idx on public.utw_stat_awards(member_id,train_date desc);
create table if not exists public.utw_stat_audit (
 id bigint generated always as identity primary key,
 action text not null,
 details jsonb not null,
 created_at timestamptz not null default now()
);
do $$
declare t text;
begin
 foreach t in array array['utw_stat_members','utw_stat_aliases','utw_stat_imports','utw_stat_values','utw_stat_ds','utw_stat_exceptions','utw_stat_awards','utw_stat_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select, insert, update, delete on public.%I to service_role',t);
 end loop;
end $$;
grant usage, select on all sequences in schema public to service_role;

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
 update public.utw_stat_awards set member_id=p_target where member_id=p_source;
 update public.utw_stat_exceptions set member_id=p_target where member_id=p_source;
 insert into public.utw_stat_audit(action,details) values('merge_members',jsonb_build_object('source_id',p_source,'source_name',source_name,'target_id',p_target));
 delete from public.utw_stat_members where id=p_source;
end $$;
revoke all on function public.utw_stat_merge_members(uuid,uuid) from public, anon, authenticated;
grant execute on function public.utw_stat_merge_members(uuid,uuid) to service_role;

-- Private image evidence: no public storage policies are installed.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('utw-r4-ds-evidence','utw-r4-ds-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
