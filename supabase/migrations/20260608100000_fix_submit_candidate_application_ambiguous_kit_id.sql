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

  insert into public.candidate_applications as ca (
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
    candidate_user_id = coalesce(ca.candidate_user_id, auth.uid()),
    updated_at = now()
  returning
    ca.id,
    ca.interview_kit_id,
    ca.status
  into saved_row;

  application_id := saved_row.id;
  interview_kit_id := saved_row.interview_kit_id;
  application_status := saved_row.status;
  return next;
end;
$$;

grant execute on function public.submit_candidate_application(text, text, text, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
