-- Store roles extracted from resumes and roles entered manually by candidates.
alter table if exists public.profiles
  add column if not exists resume_roles text[] default '{}';

alter table if exists public.profiles
  add column if not exists target_roles text[] default '{}';

update public.profiles
set resume_roles = '{}'
where resume_roles is null;

update public.profiles
set target_roles = '{}'
where target_roles is null;

alter table if exists public.profiles
  alter column resume_roles set default '{}',
  alter column resume_roles set not null,
  alter column target_roles set default '{}',
  alter column target_roles set not null;

notify pgrst, 'reload schema';
