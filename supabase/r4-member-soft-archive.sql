-- One-time, non-destructive change for R4 member archiving.
-- Run against the existing UTW Data Supabase project.
-- Archiving does not delete nicknames, VS points, train records, or member rows.
ALTER TABLE public.utw_stat_members
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;
COMMENT ON COLUMN public.utw_stat_members.archived_at IS
  'R4 soft archive time. Historical nicknames and scores remain linked; NULL means active.';
