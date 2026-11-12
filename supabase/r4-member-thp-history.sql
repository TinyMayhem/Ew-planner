-- Historical member THP snapshots. Never overwrite a different measurement date.
create table if not exists public.utw_r4_member_thp_history (
  source_member_id text not null check (length(source_member_id) between 1 and 100),
  recorded_on date not null,
  member_name text not null check (length(btrim(member_name)) between 1 and 100),
  thp bigint not null check (thp >= 0 and thp <= 9007199254740991),
  entry_source text not null default 'manual' check (length(entry_source) between 1 and 180),
  updated_at timestamptz not null default now(),
  updated_by text not null default 'R4' check (length(updated_by) between 1 and 80),
  primary key(source_member_id,recorded_on)
);
create index if not exists utw_r4_member_thp_history_dates_idx
  on public.utw_r4_member_thp_history(recorded_on desc);
create index if not exists utw_r4_member_thp_history_member_date_idx
  on public.utw_r4_member_thp_history(source_member_id,recorded_on desc);
alter table public.utw_r4_member_thp_history enable row level security;
revoke all on public.utw_r4_member_thp_history from public, anon, authenticated;
grant select,insert,update,delete on public.utw_r4_member_thp_history to service_role;

-- Show each member's most recent recorded THP ON OR BEFORE the selected date.
-- This is not necessarily a measurement taken on the exact selected day.
create or replace function public.utw_r4_thp_latest(p_date date)
returns table(
  source_member_id text, member_name text, thp bigint, recorded_on date,
  entry_source text, updated_at timestamptz, updated_by text
)
language sql stable security invoker set search_path = ''
as $$
 select distinct on (h.source_member_id)
  h.source_member_id,h.member_name,h.thp,h.recorded_on,
  h.entry_source,h.updated_at,h.updated_by
 from public.utw_r4_member_thp_history h
 where h.recorded_on<=p_date
 order by h.source_member_id,h.recorded_on desc;
$$;
revoke all on function public.utw_r4_thp_latest(date) from public, anon, authenticated;
grant execute on function public.utw_r4_thp_latest(date) to service_role;
