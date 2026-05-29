-- Add resume_url column to profiles for storing candidate resume public URL
alter table if exists public.profiles
  add column if not exists resume_url text;

-- No RLS changes required; existing profile policies already restrict updates to profile owner.

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "resumes_select_public" on storage.objects;
drop policy if exists "resumes_insert_own_folder" on storage.objects;
drop policy if exists "resumes_update_own_folder" on storage.objects;
drop policy if exists "resumes_delete_own_folder" on storage.objects;

create policy "resumes_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'resumes');

create policy "resumes_insert_own_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "resumes_update_own_folder"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "resumes_delete_own_folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
