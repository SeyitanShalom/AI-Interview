create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text;

update public.profiles
set full_name = ''
where full_name is null;

alter table public.profiles
  alter column full_name set default '',
  alter column full_name set not null;

notify pgrst, 'reload schema';
