-- UTW Hub: distinct R4 accounts, named seasons and dated member-visible trains.
create table if not exists public.utw_r4_accounts (
 id uuid primary key default gen_random_uuid(),
 username text not null unique check (username ~ '^[a-z0-9_.-]{3,30}$'),
 display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
 password_hash text not null,
 role text not null check (role in ('admin','r4')),
 must_change_password boolean not null default true,
 active boolean not null default true,
 session_version int not null default 1,
 created_at timestamptz not null default now(),
 last_login_at timestamptz
);
create table if not exists public.utw_stat_seasons (
 id text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
 label text not null unique check(char_length(btrim(label)) between 3 and 60),
 sort_order int not null default 0,
 created_at timestamptz not null default now()
);
insert into public.utw_stat_seasons(id,label,sort_order)
 values ('post-s5','Post Season 5',1),('s6','Season 6',2)
on conflict (id) do nothing;
alter table public.utw_stat_imports add column if not exists season_id text not null default 'post-s5' references public.utw_stat_seasons(id);
alter table public.utw_stat_ds add column if not exists season_id text not null default 'post-s5' references public.utw_stat_seasons(id);
alter table public.utw_stat_awards add column if not exists season_id text not null default 'post-s5' references public.utw_stat_seasons(id);
create index if not exists utw_imports_season_period on public.utw_stat_imports(season_id,period desc);
create index if not exists utw_ds_season_date on public.utw_stat_ds(season_id,event_date desc);
create index if not exists utw_awards_season_date on public.utw_stat_awards(season_id,train_date desc);
alter table public.utw_r4_accounts enable row level security;
alter table public.utw_stat_seasons enable row level security;
revoke all on public.utw_r4_accounts,public.utw_stat_seasons from public,anon,authenticated;
grant select,insert,update on public.utw_r4_accounts to service_role;
grant select,insert on public.utw_stat_seasons to service_role;
-- No client policies; all accounts and stats are accessed only server-side.
