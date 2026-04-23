create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null default substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invite_code)
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('candidate', 'company')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.interview_kits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  job_role text not null,
  questions jsonb not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.interview_sessions
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists companies_created_by_idx
  on public.companies(created_by);

create index if not exists companies_invite_code_idx
  on public.companies(invite_code);

create index if not exists company_members_company_id_idx
  on public.company_members(company_id);

create index if not exists company_members_user_id_idx
  on public.company_members(user_id);

create index if not exists user_roles_user_id_idx
  on public.user_roles(user_id);

create index if not exists interview_kits_company_id_idx
  on public.interview_kits(company_id);

create index if not exists interview_kits_created_by_idx
  on public.interview_kits(created_by);

create index if not exists interview_sessions_company_id_idx
  on public.interview_sessions(company_id);

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.user_roles enable row level security;
alter table public.interview_kits enable row level security;

-- companies policies

drop policy if exists "companies_select_member_or_owner" on public.companies;
create policy "companies_select_member_or_owner"
  on public.companies
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = companies.id
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "companies_insert_owner" on public.companies;
create policy "companies_insert_owner"
  on public.companies
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "companies_update_admin_or_owner" on public.companies;
create policy "companies_update_admin_or_owner"
  on public.companies
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = companies.id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = companies.id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  );

drop policy if exists "companies_delete_owner" on public.companies;
create policy "companies_delete_owner"
  on public.companies
  for delete
  to authenticated
  using (created_by = auth.uid());

-- company_members policies

drop policy if exists "company_members_select_self_admin_or_owner" on public.company_members;
create policy "company_members_select_self_admin_or_owner"
  on public.company_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = company_members.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = company_members.company_id
        and c.created_by = auth.uid()
    )
  );

drop policy if exists "company_members_insert_self_or_admin" on public.company_members;
create policy "company_members_insert_self_or_admin"
  on public.company_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = company_members.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = company_members.company_id
        and c.created_by = auth.uid()
    )
  );

drop policy if exists "company_members_update_admin_or_owner" on public.company_members;
create policy "company_members_update_admin_or_owner"
  on public.company_members
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = company_members.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = company_members.company_id
        and c.created_by = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = company_members.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = company_members.company_id
        and c.created_by = auth.uid()
    )
  );

drop policy if exists "company_members_delete_admin_or_owner" on public.company_members;
create policy "company_members_delete_admin_or_owner"
  on public.company_members
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.company_members cm
      where cm.company_id = company_members.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = company_members.company_id
        and c.created_by = auth.uid()
    )
  );

-- user_roles policies

drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_roles_insert_own" on public.user_roles;
create policy "user_roles_insert_own"
  on public.user_roles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_roles_update_own" on public.user_roles;
create policy "user_roles_update_own"
  on public.user_roles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_roles_delete_own" on public.user_roles;
create policy "user_roles_delete_own"
  on public.user_roles
  for delete
  to authenticated
  using (user_id = auth.uid());

-- interview_kits policies

drop policy if exists "interview_kits_select_company_member" on public.interview_kits;
create policy "interview_kits_select_company_member"
  on public.interview_kits
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.company_members cm
      where cm.company_id = interview_kits.company_id
        and cm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.companies c
      where c.id = interview_kits.company_id
        and c.created_by = auth.uid()
    )
  );

drop policy if exists "interview_kits_insert_company_admin_or_owner" on public.interview_kits;
create policy "interview_kits_insert_company_admin_or_owner"
  on public.interview_kits
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1
        from public.company_members cm
        where cm.company_id = interview_kits.company_id
          and cm.user_id = auth.uid()
          and cm.role = 'admin'
      )
      or exists (
        select 1
        from public.companies c
        where c.id = interview_kits.company_id
          and c.created_by = auth.uid()
      )
    )
  );

drop policy if exists "interview_kits_update_company_admin_or_owner" on public.interview_kits;
create policy "interview_kits_update_company_admin_or_owner"
  on public.interview_kits
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.company_members cm
      where cm.company_id = interview_kits.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = interview_kits.company_id
        and c.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.company_members cm
      where cm.company_id = interview_kits.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = interview_kits.company_id
        and c.created_by = auth.uid()
    )
  );

drop policy if exists "interview_kits_delete_company_admin_or_owner" on public.interview_kits;
create policy "interview_kits_delete_company_admin_or_owner"
  on public.interview_kits
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.company_members cm
      where cm.company_id = interview_kits.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = interview_kits.company_id
        and c.created_by = auth.uid()
    )
  );

create or replace function public.set_generic_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies
for each row
execute function public.set_generic_updated_at();

drop trigger if exists trg_interview_kits_updated_at on public.interview_kits;
create trigger trg_interview_kits_updated_at
before update on public.interview_kits
for each row
execute function public.set_generic_updated_at();
