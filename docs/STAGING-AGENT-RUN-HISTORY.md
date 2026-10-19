# VIXORA Staging Agent Run History

## Architecture and isolation

- Existing VIXORA authentication and personal tasks remain in Supabase project `gdxughluqryzlklrnzhz`.
- Persistent execution history is stored in the separate Supabase Free project `vixora-staging-agent-runs` (`nuofddhqznewkkryejmu), region `ap-southeast-1`.
- The new project intentionally has no mirrored users or passwords. `agent_runs.user_id` and `task_id` store the UUIDs from the existing auth/tasks project without foreign keys into the new project's `auth.users` or `public.tasks`.
- Cloudflare Worker staging calls `/functions/v1/agent-run-storage` with the signed-in user's access token and the new project's publishable API key.
- The Edge Function validates the token against the existing VIXORA Auth project and verifies task ownership in the existing `public.tasks` table. It then uses only the new project's server-side Supabase credentials to read/write its own `public.agent_runs`.
- Browser requests never receive a service-role/secret key. The new table has RLS enabled and direct grants revoked from `anon` and `authenticated`; only server-side service credentials access it.
- Production `vixora.my.id` and the original Supabase project schema are not changed.

## Table

Migration: `supabase/migrations/202610160001_agent_runs.sql`

The table records:
- `planned` records created with **Prepare run**.
- `running` records created before an actual Gemini request.
- `succeeded` records with model, answer, token usage and limitations.
- `failed` records with a short error message.
- timestamps, chosen agent, executor label, attempt count, input metadata and status.

## Edge Function

Source: `supabase/functions/agent-run-storage/index.ts`

Deployment settings: `supabase/config.toml` sets `verify_jwt = false` because the bearer token is minted by the existing VIXORA Auth project, not the new storage project's Auth. The function performs its own user validation before any database operations. Requests without a valid VIXORA token are rejected.

Supported methods:
- `GET`: latest 50 runs for the authenticated user's UUID.
- `POST { "task_id": "..." }`: create a plan-only record.
- `POST { "task_id": "...", "run_kind": "ai" }`: create a `running` record before the Gemini API request.
- `PATCH { "run_id": "...", "status": "succeeded", "output": { ... } }`: persist a successful result.
- `PATCH { "run_id": "...", "status": "failed", "error_message": "..." }`: persist a failure.

User ID is always derived by the Edge Function from the validated token; clients cannot select another user's `user_id`. Update requests include both run ID and authenticated user ID in the server-side database filter.

## Cloudflare / environment

The Worker contains the storage Edge Function URL and its publishable key (publishable keys are designed to be public). No storage service-role key is configured in Cloudflare or browser code; the Edge Function gets its own admin credential from its managed runtime environment.

Keep all code and deployment changes on `redesign/sveltekit-staging`. Do not merge to `main` until the end-to-end history test passes.

## Verification checklist

1. `npm run check`.
2. `npm test`.
3. `npm run build`.
4. Deploy the staging Worker.
5. Sign in and run one task; verify the response still appears.
6. Confirm `Agent run history` shows a `succeeded` row with model, token count, timestamp and expandable answer.
7. Create a plan-only run using **Prepare run** and confirm it shows `planned`.
8. Confirm the new project's `public.agent_runs` has records and the old project's tables/migrations are unchanged.
