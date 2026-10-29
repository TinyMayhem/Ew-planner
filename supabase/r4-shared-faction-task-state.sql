-- Shared faction land-planning comments and site-saved checklist completion.
alter table public.utw_r4_comments drop constraint if exists utw_r4_comments_alliance_check;
alter table public.utw_r4_comments add constraint utw_r4_comments_alliance_check
 check (alliance in ('utw','von','faction'));
-- The first group of pre-season weeks 1-2 and season weeks 1-7 coordinates land/faction.
-- Make earlier joint planning comments accessible to both partner alliances.
update public.utw_r4_comments set alliance='faction'
 where task_key ~ '^[0-8]-0-[0-9]+$' and alliance in ('utw','von');

create table if not exists public.utw_r4_task_state (
 scope text not null check (scope in ('utw','von','faction')),
 task_key text not null check (task_key ~ '^([0-9])-([0-9]+)-([0-9]+)$'),
 completed boolean not null default false,
 updated_by text not null check (char_length(updated_by) between 2 and 50),
 updated_at timestamptz not null default now(),
 primary key (scope,task_key)
);
create index if not exists utw_r4_task_state_scope_week_idx on public.utw_r4_task_state(scope,task_key);
alter table public.utw_r4_task_state enable row level security;
revoke all on public.utw_r4_task_state from public,anon,authenticated;
grant select,insert,update on public.utw_r4_task_state to service_role;

-- Preserve human-entered in-game usernames, including a single word separator.
alter table public.utw_r4_accounts drop constraint if exists utw_r4_accounts_username_check;
alter table public.utw_r4_accounts add constraint utw_r4_accounts_username_check
 check (char_length(username) between 2 and 30 and username ~ '^[a-z0-9_.-]+( [a-z0-9_.-]+)*$');
