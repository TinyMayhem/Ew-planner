-- R4-only saved THP for members imported from Alliance Duel / VS roster.
-- Deliberately keyed by source member ID, so name changes do not erase a THP value.
-- Data is stored in UTW's own Supabase database, not on the external Duel site.
create table if not exists public.utw_r4_member_thp (
  source_member_id text primary key check (length(source_member_id) between 1 and 100),
  member_name text not null check (length(btrim(member_name)) between 1 and 100),
  thp bigint not null check (thp >= 0 and thp <= 9007199254740991),
  updated_at timestamptz not null default now(),
  updated_by text not null default 'R4' check (length(updated_by) between 1 and 80)
);
create index if not exists utw_r4_member_thp_updated_idx
  on public.utw_r4_member_thp(updated_at desc);
alter table public.utw_r4_member_thp enable row level security;
revoke all on public.utw_r4_member_thp from public, anon, authenticated;
grant select, insert, update, delete on public.utw_r4_member_thp to service_role;
-- No public RLS policies. Only authenticated R4 server-side API can read/write.
