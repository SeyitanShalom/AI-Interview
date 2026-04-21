create extension if not exists pgcrypto;

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_role text not null,
  question text not null,
  status text not null default 'pending',
  overall_score numeric,
  ai_feedback jsonb,
  video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_sessions_user_id_idx
  on public.interview_sessions(user_id);

create index if not exists interview_sessions_created_at_idx
  on public.interview_sessions(created_at desc);

alter table public.interview_sessions enable row level security;

drop policy if exists "interview_sessions_select_own" on public.interview_sessions;
drop policy if exists "interview_sessions_insert_own" on public.interview_sessions;
drop policy if exists "interview_sessions_update_own" on public.interview_sessions;
drop policy if exists "interview_sessions_delete_own" on public.interview_sessions;

create policy "interview_sessions_select_own"
  on public.interview_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "interview_sessions_insert_own"
  on public.interview_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "interview_sessions_update_own"
  on public.interview_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "interview_sessions_delete_own"
  on public.interview_sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_interview_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_interview_sessions_updated_at on public.interview_sessions;
create trigger trg_interview_sessions_updated_at
before update on public.interview_sessions
for each row
execute function public.set_interview_sessions_updated_at();

insert into storage.buckets (id, name, public)
values ('interview-recordings', 'interview-recordings', true)
on conflict (id) do nothing;

drop policy if exists "interview_recordings_select_public" on storage.objects;
drop policy if exists "interview_recordings_insert_own_folder" on storage.objects;
drop policy if exists "interview_recordings_update_own_folder" on storage.objects;
drop policy if exists "interview_recordings_delete_own_folder" on storage.objects;

create policy "interview_recordings_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'interview-recordings');

create policy "interview_recordings_insert_own_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'interview-recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "interview_recordings_update_own_folder"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'interview-recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'interview-recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "interview_recordings_delete_own_folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'interview-recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
