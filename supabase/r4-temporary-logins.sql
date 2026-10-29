-- Permit short in-game names (e.g. Mo) and expire initial credentials.
-- Personal passwords remain 12-128 characters and are required at activation.
alter table public.utw_r4_accounts
 drop constraint if exists utw_r4_accounts_username_check;
alter table public.utw_r4_accounts
 add constraint utw_r4_accounts_username_check
 check (username ~ '^[a-z0-9_.-]{2,30}$');
alter table public.utw_r4_accounts
 add column if not exists temporary_expires_at timestamptz;
comment on column public.utw_r4_accounts.temporary_expires_at is
 'Short first-login passcode expires on this date. Null for a permanent personal password.';
