#!/usr/bin/env python3
"""Static schema contract checks only; requires real Supabase staging tests later."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]/"supabase"/"migrations"
files={
 "baseline":"202611160001_academy_baseline.sql",
 "assessments":"202611170001_academy_assessments.sql",
 "verification":"202611170002_academy_certificate_verification.sql",
 "profiles":"202611170003_academy_student_profiles.sql",
}
sql={key:(root/name).read_text().lower() for key,name in files.items()}
required={
 "baseline":["academy_enrollments","academy_lesson_progress","academy_certificates","enable row level security"],
 "assessments":["academy_assessment_answers","academy_assessment_attempts","academy_assignment_reviews","enable row level security"],
 "verification":["academy_verify_certificate","revoked_at is null","revoke all"],
 "profiles":["academy_create_student_profile","'student'","auth.users"],
}
for key,tokens in required.items():
 for token in tokens:
  if token not in sql[key]:
   raise SystemExit(f"Missing schema contract {key}: {token}")
if "grant execute on function public.academy_verify_certificate" in sql["verification"]:
 raise SystemExit("Public certificate verification function must not be directly granted")
print("Academy schema static contract checks passed; live RLS and auth tests still required.")
