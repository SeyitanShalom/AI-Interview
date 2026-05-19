-- Add resume_text and resume_summary columns to profiles
alter table if exists public.profiles
  add column if not exists resume_text text;

alter table if exists public.profiles
  add column if not exists resume_summary text;
