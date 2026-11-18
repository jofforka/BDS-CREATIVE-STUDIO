-- Move RLS helpers outside the Data API schema while preserving policy dependencies.
create schema academy_private;
revoke all on schema academy_private from public, anon, authenticated;

alter function public.academy_is_admin() set schema academy_private;
alter function public.academy_teaches(uuid) set schema academy_private;
alter function public.academy_is_enrolled(uuid) set schema academy_private;
alter function public.academy_lesson_course(uuid) set schema academy_private;

-- Policies already reference these functions by object ID. Authenticated
-- callers retain EXECUTE for policy evaluation without private schema USAGE.
