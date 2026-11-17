-- Optional, current main-squad details per Alliance Duel member.
-- Independent of the date-stamped THP history and train designation logic.
create table if not exists public.utw_r4_member_squad_profiles (
 source_member_id text primary key check (source_member_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 member_name text not null check (char_length(member_name) between 1 and 100),
 squad_type text check (squad_type in ('tank','air','missile')),
 squad_power bigint check (squad_power >= 0 and squad_power <= 9007199254740991),
 updated_at timestamptz not null default now(),
 updated_by text not null check (char_length(updated_by) between 1 and 80),
 constraint utw_squad_profile_has_details check (squad_type is not null or squad_power is not null)
);
alter table public.utw_r4_member_squad_profiles enable row level security;
revoke all on table public.utw_r4_member_squad_profiles from anon, authenticated;
grant select, insert, update, delete on table public.utw_r4_member_squad_profiles to service_role;
-- The authorized R4 server endpoint is the sole writer.
