-- Private, verbatim train history transcribed from the Stage 13-15 screenshots.
-- Keep screenshots separate from the editable member directory to avoid
-- assigning a historical nickname to the wrong present-day commander.
create table if not exists public.utw_stat_train_legacy (
 train_date date primary key,
 stage_no integer not null check(stage_no between 13 and 40),
 driver_name text not null check(char_length(btrim(driver_name)) between 1 and 100),
 vip_name text not null check(char_length(btrim(vip_name)) between 1 and 100),
 source text not null check(source in ('donations','ds','vs','manual')),
 selection_label text not null default '' check(char_length(selection_label)<=100),
 notes text not null default '' check(char_length(notes)<=500),
 created_at timestamptz not null default now()
);
create index if not exists utw_stat_train_legacy_stage_idx
 on public.utw_stat_train_legacy(stage_no, train_date);
alter table public.utw_stat_train_legacy enable row level security;
revoke all on public.utw_stat_train_legacy from public,anon,authenticated;
grant select,insert,update,delete on public.utw_stat_train_legacy to service_role;
