-- Distinguish R4-arranged trains from standard DS/VS/donations/roulette
-- and retain original driver information when an assigned driver is replaced.
alter table public.utw_stat_train_legacy
 add column if not exists original_driver_name text,
 add column if not exists replacement_reason text not null default '',
 add column if not exists updated_at timestamptz,
 add column if not exists updated_by text;
alter table public.utw_stat_train_legacy
 drop constraint if exists utw_stat_train_legacy_source_check;
alter table public.utw_stat_train_legacy
 add constraint utw_stat_train_legacy_source_check
 check(source in ('donations','ds','vs','manual','r4'));
update public.utw_stat_train_legacy set source='r4'
 where selection_label ~* '^R4([[:space:]]|$)' and source='manual';
alter table public.utw_stat_awards
 drop constraint if exists utw_stat_awards_source_check;
alter table public.utw_stat_awards
 add constraint utw_stat_awards_source_check
 check(source in ('ds','donations','vs','manual','r4'));
-- Both private tables remain RLS-protected and service-role only.
