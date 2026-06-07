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

update public.interview_sessions s
set company_id = ik.company_id
from public.interview_kits ik
where s.interview_kit_id = ik.id
  and s.company_id is null;

drop policy if exists "interview_sessions_select_own_or_company" on public.interview_sessions;
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
    or (
      interview_kit_id is not null
      and exists (
        select 1
        from public.interview_kits ik
        where ik.id = interview_sessions.interview_kit_id
          and (
            public.is_company_member(ik.company_id)
            or public.is_company_owner(ik.company_id)
          )
      )
    )
  );

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
        and (
          (
            s.company_id is not null
            and (
              public.is_company_member(s.company_id)
              or public.is_company_owner(s.company_id)
            )
          )
          or (
            s.interview_kit_id is not null
            and exists (
              select 1
              from public.interview_kits ik
              where ik.id = s.interview_kit_id
                and (
                  public.is_company_member(ik.company_id)
                  or public.is_company_owner(ik.company_id)
                )
            )
          )
        )
    )
  );

notify pgrst, 'reload schema';
