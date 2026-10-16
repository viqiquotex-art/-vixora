# Supabase schema audit for VIXORA v3

**Audit date:** 2026-10-16  
**Scope:** Read-only schema and RLS inspection of the existing Supabase project. No database changes were applied.

## Findings

- Existing project is active and healthy.
- `public.profiles` exists, has RLS enabled, and has owner-scoped select/insert/update policies.
- `public.tasks` already exists with `id`, `user_id`, `title`, `description`, `due_date`, `priority`, `completed`, and `created_at`. RLS is enabled and CRUD policies scope records to `auth.uid() = user_id`.
- The existing `tasks` table is a personal task list. It does not model agent execution status, assigned agent, executor run IDs, structured input/output, retries, approval state, or completion timestamps.
- Telegram tables also exist. They should remain separate from VIXORA workspace task execution.

## Decision

Do **not** repurpose `public.tasks` for agent runs. The branch includes a draft migration at `supabase/migrations/202610160001_agent_runs.sql` for a separate `public.agent_runs` table.

The migration is a design artifact only; it has not been applied. Before applying it to any database, verify staging credentials, test auth and RLS with multiple users, and decide how Worker secrets are configured.

## Security boundary

- Authenticated users may read, create, and delete only their own run records.
- The draft intentionally has no authenticated UPDATE policy. Status, executor metadata, and output should be changed by server-side Worker routes after verifying the caller's Supabase session.
- Never expose the Supabase service-role key or CREAO/n8n credentials in browser code.
- Do not dispatch a CREAO/n8n action just because a row was inserted; the server-side orchestrator must validate ownership, status, authorization, and idempotency first.
