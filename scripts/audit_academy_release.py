#!/usr/bin/env python3
"""Fail-closed static checks for the Academy staging assets (not a security certification)."""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
required = [
 "academy.html", "academy-portal.html", "academy-learn.html",
 "academy-workspace.html", "academy-verify.html",
 "academy-config.js", "academy-course-model.js",
 "supabase/migrations/202611160001_academy_baseline.sql",
 "supabase/migrations/202611170001_academy_assessments.sql",
 "supabase/migrations/202611170002_academy_certificate_verification.sql",
 "supabase/migrations/202611170003_academy_student_profiles.sql",
]
missing = [name for name in required if not (ROOT/name).is_file()]
if missing:
 raise SystemExit("Missing Academy files: " + ", ".join(missing))
config = (ROOT/"academy-config.js").read_text()
if re.search(r"(service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*['\"][^'\"]+",config,re.I):
 raise SystemExit("Potential private credential in public Academy config")
if "supabasePublishableKey" not in config or "supabaseUrl" not in config:
 raise SystemExit("Academy public config fields missing")
for name in ["academy-portal.html","academy-learn.html","academy-verify.html"]:
 content = (ROOT/name).read_text()
 if 'name="viewport"' not in content or '<main' not in content:
  raise SystemExit(f"Missing mobile viewport or main landmark: {name}")
baseline = (ROOT/required[7]).read_text().lower()
if "enable row level security" not in baseline:
 raise SystemExit("Academy baseline missing RLS")
print("Academy static release checks passed (not a deployment or security audit).")
