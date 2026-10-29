-- Season 6 alliance-specific R4 department assignments.
-- The authenticated server is the only reader/writer.
create table if not exists public.utw_r4_roles (
 alliance text not null check (alliance in ('utw','von')),
 department_key text not null check (department_key ~ '^[a-z0-9-]{2,40}$'),
 leader text not null default '' check (char_length(leader) <= 50),
 backup text not null default '' check (char_length(backup) <= 50),
 additional_backups text[] not null default '{}'::text[] check (cardinality(additional_backups) <= 15),
 updated_by text not null check (char_length(updated_by) between 1 and 50),
 updated_at timestamptz not null default now(),
 primary key(alliance,department_key)
);
create index if not exists utw_r4_roles_alliance_updated_idx on public.utw_r4_roles(alliance,updated_at desc);
alter table public.utw_r4_roles enable row level security;
revoke all on public.utw_r4_roles from public,anon,authenticated;
grant select,insert,update on public.utw_r4_roles to service_role;
