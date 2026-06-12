alter table if exists public.interview_sessions
  add column if not exists recording_quality jsonb;

notify pgrst, 'reload schema';
