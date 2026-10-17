# VIXORA Phase 3 — Agent orchestration and run lifecycle

**Status:** implementation staged; database migration is intentionally not applied to the connected Supabase project.

## What is implemented

- Small deterministic agent registry for Content Studio, Research Agent, Workflow Planner, and Strategy & Planner.
- POST /api/agent-runs takes only a saved task_id, verifies the signed-in user and task ownership through the user's JWT and RLS, chooses an agent server-side, then creates a planned run.
- GET /api/agent-runs returns the caller's run history through Supabase RLS.
- Task Center has a Prepare run button and run-history cards.
- Run plans are labelled planned / not_connected; no CREAO or n8n execution is invoked or claimed.
- Migration draft adds run lifecycle storage, ownership RLS, timestamps, and blocks browser updates to run status/output metadata.

## Safety boundary

The staging Worker currently points to the same Supabase project used by production. The migration has not been applied because that would mutate the shared production database. Until an isolated Supabase staging branch/project is available and configured, the API will return a clear schema-not-ready message for run creation. Existing personal task CRUD remains separate.

Future executor callbacks/status transitions must run in a trusted server-side runtime using a server-only secret, validate resource ownership, and allow only valid status transitions. Never mark succeeded merely because a provider accepted a request.

## Verification checklist

1. GitHub type/Svelte checks and production build.
2. Staging deploy to vixora-workspace-staging.
3. Provision isolated Supabase staging DB; apply the migration there only.
4. Set staging Worker SUPABASE_URL and SUPABASE_ANON_KEY to the isolated DB.
5. Sign in, create a task, prepare a run, refresh, and verify run history remains account-scoped.
6. After this passes, define CREAO/n8n adapter contracts and status callbacks.


## Automated router tests

Run `npm test` to check:
- registry contains the four expected initial agents;
- content, research, and workflow tasks are routed to their specialist;
- generic requests use the strategy fallback;
- Unicode-normalized terms route consistently.

The same test suite runs in GitHub Actions before the staging build.


## Router behavior guard

Specialist matching uses whole-word matching to avoid overlapping fragments (for example, `hook` inside `webhook`). Regression tests cover this overlap.
