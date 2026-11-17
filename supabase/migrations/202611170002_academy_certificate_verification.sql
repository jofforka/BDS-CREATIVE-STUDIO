-- Apply after Academy baseline and assessment migrations.
-- A restricted, privacy-minimizing lookup. No certificate issuance is enabled here.
-- This function returns only valid/invalid and issue date, never a student name.
create or replace function public.academy_verify_certificate(p_code text)
returns table(is_valid boolean, issued_on date)
language sql stable security definer set search_path = ''
as $$
 select true, c.issued_at::date
 from public.academy_certificates c
 join public.academy_courses course on course.id = c.course_id
 where c.verification_code = p_code
   and c.revoked_at is null
   and course.status = 'published'
 limit 1
$$;
revoke all on function public.academy_verify_certificate(text) from public;
-- Do not grant execute to anon/authenticated until abuse controls, audit logging,
-- explicit public verification consent and a rate-limited API gateway exist.
-- A trusted server endpoint may call the function with a privileged role after
-- applying its own throttling and disclosure checks.
