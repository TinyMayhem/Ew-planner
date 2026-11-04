-- Expand the editable train archive to support the original UTW Stage 7–16 calendars.
-- Existing rows, corrections and R4 audit history are preserved.
ALTER TABLE public.utw_stat_train_legacy
  DROP CONSTRAINT IF EXISTS utw_stat_train_legacy_stage_no_check;
ALTER TABLE public.utw_stat_train_legacy
  ADD CONSTRAINT utw_stat_train_legacy_stage_no_check
  CHECK (stage_no BETWEEN 7 AND 40);
