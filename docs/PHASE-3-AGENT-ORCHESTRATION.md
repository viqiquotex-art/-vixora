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


## Gemini Free Tier — staging setup

The staging workspace has an authenticated server endpoint at `POST /api/agent-ai`. It routes a task to one of four specialist instructions and calls only `gemini-3.8-flash` with a 1,200-token output cap. It does not enable Google Search grounding, does not invoke CREAO/n8n, and has no provider/model fallback. HTTP 429 or provider errors return a clear error rather than trying a paid alternative.

To connect an account:
1. In Google AI Studio, create an API key for a project that remains on the Free Tier. Do not attach paid billing if the intention is a strict zero-cost setup. Confirm current model availability and free quota on the official [Gemini API pricing page](https://ai.google.dev/gemini-api/docs/pricing).
2. Open Cloudflare Dashboard → Workers & Pages → `vixora-workspace-staging` → Settings → Variables and Secrets. Add `GEMINI_API_KEY` as an encrypted Secret (not a plain-text variable).
3. Save and retry **Run AI Agent** from the Task Center. The key is read only on the server; never put it in client code, Git, or chat.

Free-tier requests are still subject to Google's changing limits and data-use terms. Free Tier content may be used to improve Google products. Avoid confidential company, employee, health, or other sensitive data. VIXORA does not automatically upgrade the project or fall back to paid models. If the key is missing, endpoint returns `GEMINI_NOT_CONFIGURED`; if quota is exhausted it returns a quota error.
