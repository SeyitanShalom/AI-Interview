-- Repair/refresh the candidate profile columns used by resume uploads.
do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists user_id uuid,
      add column if not exists id uuid,
      add column if not exists role text default 'candidate',
      add column if not exists resume_url text,
      add column if not exists resume_text text,
      add column if not exists resume_summary text,
      add column if not exists resume_roles text[] default '{}',
      add column if not exists target_roles text[] default '{}';

    update public.profiles
    set user_id = id
    where user_id is null
      and id is not null;

    update public.profiles
    set id = user_id
    where id is null
      and user_id is not null;

    update public.profiles
    set role = 'candidate'
    where role is null;

    update public.profiles
    set resume_roles = '{}'
    where resume_roles is null;

    update public.profiles
    set target_roles = '{}'
    where target_roles is null;

    alter table public.profiles
      alter column role set default 'candidate',
      alter column resume_roles set default '{}',
      alter column target_roles set default '{}',
      alter column resume_roles set not null,
      alter column target_roles set not null;

    create unique index if not exists profiles_user_id_key
      on public.profiles(user_id);
  end if;
end $$;

notify pgrst, 'reload schema';
