# BDS Academy release gates

## Status: NOT production-ready

This checklist is required before enabling Academy registrations, private content, assessments or certificates. GitHub Pages is a public static host; it cannot safely hold server secrets or enforce paid-course entitlements.

### Automated checks
- Run `python3 scripts/audit_academy_release.py` plus existing site validation and Node tests.
- Confirm GitHub Actions and GitHub Pages deployment are green on the exact main-branch commit.

### Manual checks
- Verify every public navigation link and all mobile layouts (320px through desktop), focus visibility, keyboard operation, screen readers and contrast.
- Run real authentication and password recovery flows in staging, including expired links and cross-account access.
- Apply migrations to disposable Supabase staging database in order and test RLS with separate student, instructor and admin identities.
- Verify course publishing permissions, enrollment gating, private media URLs, secure uploads and course progress integrity.
- Test quiz attempt limits, protected answers, instructor grading, certificate issuance, revocation and verification.
- Review privacy policy, retention, account deletion, payment handling if applicable, incident response and backup/recovery.
- Validate staging data isolation and secrets; publishable keys are public, service-role credentials never enter GitHub Pages.
- Record test evidence, defects, owners, and go/no-go sign-off.

### Current blockers
Supabase project is not configured; the database migrations have not been executed; real backend APIs are not implemented; no end-to-end student journey has been validated. Preview pages must not be marketed as functioning LMS features.
