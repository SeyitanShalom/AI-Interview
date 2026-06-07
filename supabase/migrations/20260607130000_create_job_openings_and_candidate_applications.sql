create extension if not exists pgcrypto;

create or replace function public.set_generic_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

create table if not exists public.job_openings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  interview_kit_id uuid not null references public.interview_kits(id) on delete restrict,
  title text not null,
  description text not null default '',
  location text not null default '',
  employment_type text not null default '',
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  apply_token text not null default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (apply_token)
);

alter table public.job_openings
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists interview_kit_id uuid references public.interview_kits(id) on delete restrict,
  add column if not exists title text,
  add column if not exists description text not null default '',
  add column if not exists location text not null default '',
  add column if not exists employment_type text not null default '',
  add column if not exists status text not null default 'open',
  add column if not exists apply_token text not null default replace(gen_random_uuid()::text, '-', ''),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.candidate_applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_opening_id uuid not null references public.job_openings(id) on delete cascade,
  interview_kit_id uuid not null references public.interview_kits(id) on delete restrict,
  candidate_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  cover_note text,
  status text not null default 'applied' check (status in ('applied', 'interview_started', 'interview_completed', 'archived')),
  interview_session_id uuid references public.interview_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_opening_id, email)
);

alter table public.candidate_applications
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists job_opening_id uuid references public.job_openings(id) on delete cascade,
  add column if not exists interview_kit_id uuid references public.interview_kits(id) on delete restrict,
  add column if not exists candidate_user_id uuid references auth.users(id) on delete set null,
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists cover_note text,
  add column if not exists status text not null default 'applied',
  add column if not exists interview_session_id uuid references public.interview_sessions(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.interview_sessions
  add column if not exists candidate_application_id uuid references public.candidate_applications(id) on delete set null;

create index if not exists job_openings_company_id_idx
  on public.job_openings(company_id);

create index if not exists job_openings_interview_kit_id_idx
  on public.job_openings(interview_kit_id);

create index if not exists job_openings_apply_token_idx
  on public.job_openings(apply_token);

create index if not exists candidate_applications_company_id_idx
  on public.candidate_applications(company_id);

create index if not exists candidate_applications_job_opening_id_idx
  on public.candidate_applications(job_opening_id);

create index if not exists candidate_applications_interview_kit_id_idx
  on public.candidate_applications(interview_kit_id);

create index if not exists candidate_applications_candidate_user_id_idx
  on public.candidate_applications(candidate_user_id);

create index if not exists interview_sessions_candidate_application_id_idx
  on public.interview_sessions(candidate_application_id);

drop trigger if exists trg_job_openings_updated_at on public.job_openings;
create trigger trg_job_openings_updated_at
before update on public.job_openings
for each row
execute function public.set_generic_updated_at();

drop trigger if exists trg_candidate_applications_updated_at on public.candidate_applications;
create trigger trg_candidate_applications_updated_at
before update on public.candidate_applications
for each row
execute function public.set_generic_updated_at();

alter table public.job_openings enable row level security;
alter table public.candidate_applications enable row level security;

drop policy if exists "job_openings_select_company" on public.job_openings;
create policy "job_openings_select_company"
  on public.job_openings
  for select
  to authenticated
  using (
    public.is_company_member(company_id)
    or public.is_company_owner(company_id)
  );

drop policy if exists "job_openings_insert_admin_or_owner" on public.job_openings;
create policy "job_openings_insert_admin_or_owner"
  on public.job_openings
  for insert
  to authenticated
  with check (
    (
      public.is_company_admin(company_id)
      or public.is_company_owner(company_id)
    )
    and exists (
      select 1
      from public.interview_kits ik
      where ik.id = interview_kit_id
        and ik.company_id = company_id
    )
  );

drop policy if exists "job_openings_update_admin_or_owner" on public.job_openings;
create policy "job_openings_update_admin_or_owner"
  on public.job_openings
  for update
  to authenticated
  using (
    public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
  )
  with check (
    (
      public.is_company_admin(company_id)
      or public.is_company_owner(company_id)
    )
    and exists (
      select 1
      from public.interview_kits ik
      where ik.id = interview_kit_id
        and ik.company_id = company_id
    )
  );

drop policy if exists "job_openings_delete_admin_or_owner" on public.job_openings;
create policy "job_openings_delete_admin_or_owner"
  on public.job_openings
  for delete
  to authenticated
  using (
    public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
  );

drop policy if exists "candidate_applications_select_company" on public.candidate_applications;
create policy "candidate_applications_select_company"
  on public.candidate_applications
  for select
  to authenticated
  using (
    public.is_company_member(company_id)
    or public.is_company_owner(company_id)
    or candidate_user_id = auth.uid()
  );

drop policy if exists "candidate_applications_update_company_or_candidate" on public.candidate_applications;
create policy "candidate_applications_update_company_or_candidate"
  on public.candidate_applications
  for update
  to authenticated
  using (
    public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
    or candidate_user_id = auth.uid()
  )
  with check (
    public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
    or candidate_user_id = auth.uid()
  );

drop policy if exists "candidate_applications_delete_admin_or_owner" on public.candidate_applications;
create policy "candidate_applications_delete_admin_or_owner"
  on public.candidate_applications
  for delete
  to authenticated
  using (
    public.is_company_admin(company_id)
    or public.is_company_owner(company_id)
  );

create or replace function public.get_public_job_opening(opening_token text)
returns table (
  id uuid,
  title text,
  description text,
  location text,
  employment_type text,
  status text,
  company_id uuid,
  company_name text,
  interview_kit_id uuid,
  job_role text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    jo.id,
    jo.title,
    jo.description,
    jo.location,
    jo.employment_type,
    jo.status,
    jo.company_id,
    c.name as company_name,
    jo.interview_kit_id,
    ik.job_role
  from public.job_openings jo
  join public.companies c on c.id = jo.company_id
  join public.interview_kits ik on ik.id = jo.interview_kit_id
  where jo.apply_token = opening_token
    and jo.status = 'open';
$$;

create or replace function public.submit_candidate_application(
  opening_token text,
  applicant_full_name text,
  applicant_email text,
  applicant_phone text default null,
  applicant_note text default null
)
returns table (
  application_id uuid,
  interview_kit_id uuid,
  application_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  opening_row record;
  saved_row record;
  normalized_email text;
begin
  normalized_email := lower(trim(applicant_email));

  if length(trim(applicant_full_name)) < 2 then
    raise exception 'Full name is required.';
  end if;

  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid email address is required.';
  end if;

  select
    jo.id,
    jo.company_id,
    jo.interview_kit_id
  into opening_row
  from public.job_openings jo
  where jo.apply_token = opening_token
    and jo.status = 'open';

  if not found then
    raise exception 'This application link is not available.';
  end if;

  insert into public.candidate_applications (
    company_id,
    job_opening_id,
    interview_kit_id,
    candidate_user_id,
    full_name,
    email,
    phone,
    cover_note,
    status
  )
  values (
    opening_row.company_id,
    opening_row.id,
    opening_row.interview_kit_id,
    auth.uid(),
    trim(applicant_full_name),
    normalized_email,
    nullif(trim(coalesce(applicant_phone, '')), ''),
    nullif(trim(coalesce(applicant_note, '')), ''),
    'applied'
  )
  on conflict (job_opening_id, email)
  do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    cover_note = excluded.cover_note,
    candidate_user_id = coalesce(public.candidate_applications.candidate_user_id, auth.uid()),
    updated_at = now()
  returning id, interview_kit_id, status into saved_row;

  application_id := saved_row.id;
  interview_kit_id := saved_row.interview_kit_id;
  application_status := saved_row.status;
  return next;
end;
$$;

create or replace function public.link_candidate_application_session(
  application_uuid uuid,
  session_uuid uuid,
  next_status text default 'interview_started'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text;
begin
  normalized_status := case
    when next_status in ('applied', 'interview_started', 'interview_completed')
      then next_status
    else 'interview_started'
  end;

  update public.candidate_applications ca
  set
    candidate_user_id = coalesce(ca.candidate_user_id, auth.uid()),
    interview_session_id = session_uuid,
    status = normalized_status,
    updated_at = now()
  from public.interview_sessions s
  where ca.id = application_uuid
    and s.id = session_uuid
    and s.user_id = auth.uid()
    and ca.interview_kit_id = s.interview_kit_id
    and (ca.candidate_user_id is null or ca.candidate_user_id = auth.uid());

  update public.interview_sessions s
  set candidate_application_id = application_uuid
  from public.candidate_applications ca
  where s.id = session_uuid
    and s.user_id = auth.uid()
    and ca.id = application_uuid
    and ca.interview_kit_id = s.interview_kit_id
    and (ca.candidate_user_id is null or ca.candidate_user_id = auth.uid());
end;
$$;

grant execute on function public.get_public_job_opening(text)
  to anon, authenticated;

grant execute on function public.submit_candidate_application(text, text, text, text, text)
  to anon, authenticated;

grant execute on function public.link_candidate_application_session(uuid, uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
