# Week 7 schema, migration, and verification status

## Scope

Both applications use the Supabase project ref `zmlkyxhjslnmihzplkui`. The main repository is available at `../designingforgenai`. This project ref is not a credential. No database connection, migration execution, deployment, or production setting change was made during this work.

The shared schema is expected to contain `profiles`, `images`, `generations`, `votes`, and `admin_audit_log`. The main repo's timestamped migration history creates base `profiles`, `images`, `generations`, and `votes`, but the profile role/superadmin/ban fields, generation moderation fields, and `admin_audit_log` come from non-timestamped SQL in the separate admin repo. A clean local replay of only the main repo's migrations therefore does not reproduce the full expected shared schema. The Week 7 migration and preflight now check those confirmed prerequisites rather than guessing or adding another baseline migration.

## Week 7 migration

File: `../designingforgenai/supabase/migrations/20261028000000_week7_admin_observability.sql`

The versioned migration defines all eleven Week 7 tables and their constraints, foreign keys, indexes, RLS, grants, updated-at triggers, provider seed, signup RPC, and signup trigger. It uses plain `CREATE TABLE`/`CREATE INDEX` after a guard that stops if a target table/index/function/trigger/policy name already exists. A matching name still needs inspection; the guard does not claim that the existing definition is compatible. The duplicate `(chain_id, step_order)` index was removed because the unique constraint already creates that index.

The separate `../designingforgenai/supabase/preflight_week7_admin_observability.sql` is SELECT-only. It reports existing target tables, missing or type-mismatched expected columns, extra columns, prerequisite core columns, and conflicting policies, functions, triggers, and index names. Review its results and the definitions/constraints of any existing object before applying anything. Do not rerun this one-shot migration after partial application without reconciling the actual schema and migration history.

## Signup behavior

- No active allowlist rules means signups remain unrestricted.
- On first activation of an email/domain rule, the database records `enabled_at`. Accounts created on or before the earliest active-rule timestamp remain eligible, so enabling a new allowlist does not lock out the existing user base.
- Accounts created after activation must match an enabled exact email or exact domain. The `auth.users` insert trigger is the final enforcement point.
- Admin pre-provisioning uses the same allowlist. The admin API checks first to give a clear error, and the database trigger catches races. There is no user-controlled bypass. Add an email or its domain to an enabled allowlist before using the admin pre-provision action.
- If a new Google signup is rejected by the trigger, the callback maps the trigger marker/SQL permission code—and GoTrue's generic `Database error saving new user` wrapper—to a user-facing account-creation/allowlist notice. The notice advises checking the allowlist rather than claiming the SQL detail was returned by Supabase. Other OAuth errors retain the generic sign-in error response.
- Existing accounts predating activation remain grandfathered even if absent from the list. Use the existing admin ban controls to revoke an existing account; removing a whitelist entry only revokes access for post-activation accounts.

## Provider and model behavior

The admin form labels `endpoint_url` as informational: caption generation always calls Gemini's fixed REST endpoint. Only Google Gemini is a runtime backend; other provider records are metadata. For captioning, the newest enabled model associated with the enabled Google Gemini provider is selected. If no such model exists, the app uses `GEMINI_MODEL`, then the existing built-in fallback. A disabled Gemini provider or an invalid selected/fallback model identifier returns a configuration error without calling the provider.

## Security notes

- New tables have RLS. Table privileges are revoked from `PUBLIC`, `anon`, and `authenticated` before narrow authenticated read grants and service-role grants are made. Allowlist contents and LLM response bodies are not readable by browser clients.
- The admin app's service-role key bypasses RLS. New admin APIs retain the existing server-side permission guard before privileged operations.
- The main app's service-role client is in a `server-only` module and used only after authenticating the caller. The admin app's service client module is now also marked `server-only`, and its browser uploader imports the separate anon client. The main local environment currently lacks `SUPABASE_SERVICE_ROLE_KEY`, so observability writes require that server-only variable to be configured before deployment.
- Never add a `NEXT_PUBLIC_` service-role variable or provider secret. The service key must not reach browser code.

## CLI configuration and safe workflow

Added `../designingforgenai/supabase/config.toml` with only the local CLI `project_id`; it does not link to a remote project or contain credentials. The repo currently lacks timestamped history for the admin-added core columns described above, so inspect migration history and preflight output before pushing. A local `db reset` is not claimed to reproduce the shared schema until that history is reconciled.

From the main app repository, when ready:

```sh
supabase login
supabase link --project-ref zmlkyxhjslnmihzplkui
supabase projects list
supabase migration list --linked
```

Confirm the linked project ref in the CLI output/dashboard and review that all earlier migrations are accounted for. Run the read-only preflight SQL against the intended database, for example from the Supabase SQL editor using this SELECT-only file or through an explicitly read-only database connection. Resolve any existing objects or missing prerequisite columns first.

Preview, inspect, then apply only after approval:

```sh
supabase db push --dry-run --linked
supabase db push --linked
supabase migration list --linked
```

The dry run should show only the reviewed pending migration(s). Do not use `db reset --linked`; it is destructive. Supabase tracks applied migrations in `supabase_migrations.schema_migrations`; prefer the CLI so SQL application and migration history stay synchronized. If SQL was already applied manually, verify the complete resulting schema and policies first, then use `supabase migration repair 20261028000000 --status applied` to record history without replaying SQL. Do not mark it applied if only part of the migration exists. If partial application occurred, stop and reconcile using a separately reviewed recovery migration; do not rerun the one-shot file blindly.

## Verification and remaining steps

- Admin: TypeScript and production build pass. Lint remains unavailable because this repo has no ESLint config and Next.js opens its first-use setup prompt.
- Main: TypeScript and production build pass; lint passes with the existing `<img>` optimization warning. `git diff --check` passes in both repos.
- Admin API authorization guards, server-only service-role usage, and the eleven-table RLS/grant definitions were source-reviewed. Database behavior, auth-trigger behavior, CRUD, storage operations, and observability writes have **not** been live-verified.
- Before deployment: review and run the read-only preflight; reconcile main/admin migration history; apply through the linked Supabase CLI only after confirming the ref and reviewing the dry run; set the main app's server-only `SUPABASE_SERVICE_ROLE_KEY`; run auth, allowlist, CRUD, storage, and generation logging tests against a non-production project; then deploy the two Vercel apps separately after approval.

Main app environment variable names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`, optional `GEMINI_MODEL` and `SUPABASE_URL`. Admin app names: `NEXT_SUPABASE_URL`, `NEXT_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXT_MAIN_APP_URL`. No secret values are recorded here.
