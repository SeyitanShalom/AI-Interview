-- Add resume_url column to profiles for storing candidate resume public URL
alter table if exists public.profiles
  add column if not exists resume_url text;

-- No RLS changes required; existing profile policies already restrict updates to profile owner.
