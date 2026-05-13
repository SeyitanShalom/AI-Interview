create table if not exists public.company_invite_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists company_invite_links_company_id_idx
  on public.company_invite_links(company_id);

create index if not exists company_invite_links_token_idx
  on public.company_invite_links(token);

create index if not exists company_invite_links_expires_at_idx
  on public.company_invite_links(expires_at);

alter table public.company_invite_links enable row level security;

drop policy if exists "company_invite_links_select_admin_or_owner" on public.company_invite_links;
create policy "company_invite_links_select_admin_or_owner"
  on public.company_invite_links
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = company_invite_links.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = company_invite_links.company_id
        and c.created_by = auth.uid()
    )
  );

drop policy if exists "company_invite_links_insert_admin_or_owner" on public.company_invite_links;
create policy "company_invite_links_insert_admin_or_owner"
  on public.company_invite_links
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = company_invite_links.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = company_invite_links.company_id
        and c.created_by = auth.uid()
    )
  );

drop policy if exists "company_invite_links_update_admin_or_owner" on public.company_invite_links;
create policy "company_invite_links_update_admin_or_owner"
  on public.company_invite_links
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = company_invite_links.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = company_invite_links.company_id
        and c.created_by = auth.uid()
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = company_invite_links.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = company_invite_links.company_id
        and c.created_by = auth.uid()
    )
  );

drop policy if exists "company_invite_links_delete_admin_or_owner" on public.company_invite_links;
create policy "company_invite_links_delete_admin_or_owner"
  on public.company_invite_links
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.company_id = company_invite_links.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = company_invite_links.company_id
        and c.created_by = auth.uid()
    )
  );