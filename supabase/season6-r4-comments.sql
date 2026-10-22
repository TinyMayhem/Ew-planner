-- UTW Season 6 R4 Command Centre discussion storage.
-- Run ONCE in the existing Supabase project's SQL Editor.
-- The API exclusively uses the existing server-only SUPABASE_SECRET_KEY.

create table if not exists public.utw_r4_comments (
  id bigint generated always as identity primary key,
  task_key text not null check (task_key ~ '^[0-9]-[0-9]+-[0-9]+$'),
  author text not null check (char_length(btrim(author)) between 1 and 40),
  body text not null check (char_length(btrim(body)) between 1 and 1200),
  created_at timestamptz not null default now()
);

create index if not exists utw_r4_comments_task_time_idx
  on public.utw_r4_comments (task_key, created_at desc);

alter table public.utw_r4_comments enable row level security;
revoke all on public.utw_r4_comments from public, anon, authenticated;
revoke all on sequence public.utw_r4_comments_id_seq from public, anon, authenticated;
grant select, insert on public.utw_r4_comments to service_role;
grant usage, select on sequence public.utw_r4_comments_id_seq to service_role;

-- No policies are created for anon or authenticated.
-- R4 access is enforced by the Vercel API using a signed HttpOnly cookie.
-- Do not expose the service role key in the browser or public repository.
