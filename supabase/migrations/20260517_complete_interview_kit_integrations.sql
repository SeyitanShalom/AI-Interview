create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.get_shared_interview_kit(kit_uuid uuid)
returns table (
  id uuid,
  title text,
  job_role text,
  questions jsonb,
  company_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ik.id,
    ik.title,
    ik.job_role,
    ik.questions,
    ik.company_id,
    ik.created_at
  from public.interview_kits ik
  where ik.id = kit_uuid;
$$;

grant execute on function public.get_shared_interview_kit(uuid)
  to anon, authenticated;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_self_or_reviewing_company" on public.profiles;
create policy "profiles_select_self_or_reviewing_company"
  on public.profiles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.interview_sessions s
      where s.user_id = profiles.user_id
        and s.company_id is not null
        and (
          public.is_company_member(s.company_id)
          or public.is_company_owner(s.company_id)
        )
    )
  );

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_generic_updated_at();

alter table public.interview_sessions
  add column if not exists company_id uuid references public.companies(id) on delete set null,
  add column if not exists interview_kit_id uuid references public.interview_kits(id) on delete set null,
  add column if not exists content_score numeric,
  add column if not exists style_score numeric,
  add column if not exists completed_at timestamptz;

create index if not exists interview_sessions_company_id_idx
  on public.interview_sessions(company_id);

create index if not exists interview_sessions_interview_kit_id_idx
  on public.interview_sessions(interview_kit_id);

update public.interview_sessions
set
  content_score = coalesce(
    content_score,
    nullif(ai_feedback->>'content_score', '')::numeric
  ),
  style_score = coalesce(
    style_score,
    nullif(ai_feedback->>'style_score', '')::numeric
  ),
  completed_at = coalesce(completed_at, updated_at)
where status = 'completed'
  and ai_feedback is not null;

drop policy if exists "interview_sessions_select_own" on public.interview_sessions;
drop policy if exists "interview_sessions_insert_own" on public.interview_sessions;
drop policy if exists "interview_sessions_update_own" on public.interview_sessions;
drop policy if exists "interview_sessions_delete_own" on public.interview_sessions;
drop policy if exists "interview_sessions_select_own_or_company" on public.interview_sessions;
drop policy if exists "interview_sessions_insert_own_candidate" on public.interview_sessions;
drop policy if exists "interview_sessions_update_own_candidate" on public.interview_sessions;
drop policy if exists "interview_sessions_delete_own_candidate" on public.interview_sessions;

create policy "interview_sessions_select_own_or_company"
  on public.interview_sessions
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or (
      company_id is not null
      and (
        public.is_company_member(company_id)
        or public.is_company_owner(company_id)
      )
    )
  );

create policy "interview_sessions_insert_own_candidate"
  on public.interview_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "interview_sessions_update_own_candidate"
  on public.interview_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "interview_sessions_delete_own_candidate"
  on public.interview_sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);
