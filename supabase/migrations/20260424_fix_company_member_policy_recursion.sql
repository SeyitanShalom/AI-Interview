create or replace function public.is_company_owner(company_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = company_uuid
      and c.created_by = auth.uid()
  );
$$;

create or replace function public.is_company_member(company_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = company_uuid
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_company_admin(company_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = company_uuid
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
  );
$$;

-- Companies

drop policy if exists "companies_select_member_or_owner" on public.companies;
create policy "companies_select_member_or_owner"
  on public.companies
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_company_member(id)
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
    or public.is_company_admin(id)
  )
  with check (
    created_by = auth.uid()
    or public.is_company_admin(id)
  );

drop policy if exists "companies_delete_owner" on public.companies;
create policy "companies_delete_owner"
  on public.companies
  for delete
  to authenticated
  using (created_by = auth.uid());

-- company_members

drop policy if exists "company_members_select_self_admin_or_owner" on public.company_members;
create policy "company_members_select_self_admin_or_owner"
  on public.company_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
  );

drop policy if exists "company_members_insert_self_or_admin" on public.company_members;
create policy "company_members_insert_self_or_admin"
  on public.company_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
  );

drop policy if exists "company_members_update_admin_or_owner" on public.company_members;
create policy "company_members_update_admin_or_owner"
  on public.company_members
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
  )
  with check (
    user_id = auth.uid()
    or public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
  );

drop policy if exists "company_members_delete_admin_or_owner" on public.company_members;
create policy "company_members_delete_admin_or_owner"
  on public.company_members
  for delete
  to authenticated
  using (
    public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
  );

-- interview_kits

drop policy if exists "interview_kits_select_company_member" on public.interview_kits;
create policy "interview_kits_select_company_member"
  on public.interview_kits
  for select
  to authenticated
  using (
    public.is_company_member(company_id)
    or public.is_company_owner(company_id)
  );

drop policy if exists "interview_kits_insert_company_admin_or_owner" on public.interview_kits;
create policy "interview_kits_insert_company_admin_or_owner"
  on public.interview_kits
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_company_admin(company_id)
      or public.is_company_owner(company_id)
    )
  );

drop policy if exists "interview_kits_update_company_admin_or_owner" on public.interview_kits;
create policy "interview_kits_update_company_admin_or_owner"
  on public.interview_kits
  for update
  to authenticated
  using (
    public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
  )
  with check (
    public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
  );

drop policy if exists "interview_kits_delete_company_admin_or_owner" on public.interview_kits;
create policy "interview_kits_delete_company_admin_or_owner"
  on public.interview_kits
  for delete
  to authenticated
  using (
    public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
  );
