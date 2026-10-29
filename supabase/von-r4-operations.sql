-- Separate VON operations access from UTW member data; separate checklist discussions.
alter table public.utw_r4_accounts drop constraint if exists utw_r4_accounts_role_check;
alter table public.utw_r4_accounts add constraint utw_r4_accounts_role_check
 check (role in ('admin','r4','von'));

alter table public.utw_r4_comments add column if not exists alliance text not null default 'utw';
alter table public.utw_r4_comments drop constraint if exists utw_r4_comments_alliance_check;
alter table public.utw_r4_comments add constraint utw_r4_comments_alliance_check
 check (alliance in ('utw','von'));
create index if not exists utw_r4_comments_alliance_week_idx
 on public.utw_r4_comments (alliance,task_key,created_at desc);
-- Existing comments remain tagged UTW. Only server-side service_role may access this table.
