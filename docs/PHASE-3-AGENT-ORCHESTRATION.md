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


## Alibaba Cloud Model Studio — Qwen3.8-Flash Free Tier

The authenticated staging endpoint `POST /api/agent-ai` routes saved tasks to one of four specialist instructions and calls only `qwen3.8-flash` using Alibaba Cloud Model Studio's OpenAI-compatible Chat Completions API in Singapore / International scope.

### Runtime safeguards

- Uses a general-purpose Model Studio API key in the Worker secret `DASHSCOPE_API_KEY`. Never use the DashVector API key in this integration.
- Uses the workspace-specific Singapore host when `MODELSTUDIO_WORKSPACE_ID` is configured: `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions`.
- If the workspace ID is not configured, uses the official legacy Singapore endpoint `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions`, which Model Studio documentation says remains supported.
- Sets `max_completion_tokens: 1200` and `enable_thinking: false` to constrain response size and avoid unnecessary reasoning-token consumption.
- Before any model request, requires `DASHSCOPE_FREE_QUOTA_ONLY_CONFIRMED=true`. This server-side gate is only a confirmation flag; it does **not** enable the Alibaba console setting by itself.
- Has no provider/model fallback and does not invoke CREAO/n8n, web search, or external tools. The result is text/draft only.
- Detects Alibaba's `AllocationQuota.FreeTierOnly` response and returns a clear quota-exhausted message, with no retry using another provider.

### Account setup checklist

1. In Alibaba Cloud Model Studio, select **Singapore** region and the **International** service scope for `qwen3.8-flash`.
2. Check that the model details / Free Quota page shows remaining free quota and a valid expiration date. Free quotas are subject to model and account eligibility and commonly expire 90 days after the applicable start date; confirm the actual amount in this account.
3. Enable **Free Quota Only** for `qwen3.8-flash` in the console. The setting is disabled by default; after enabling it, wait for the change to take effect before invoking the API. Alibaba documents that the endpoint then returns `AllocationQuota.FreeTierOnly` after free quota runs out instead of charging subsequent inference.
4. Obtain a **general-purpose Model Studio API key** (not a DashVector key, and not a Token Plan/Coding Plan dedicated key) and add it to Cloudflare staging as encrypted Secret `DASHSCOPE_API_KEY`.
5. Optionally set `MODELSTUDIO_WORKSPACE_ID` as a regular Worker variable, using the exact ID on Model Studio Workspace Details. If unset, the API uses the documented legacy Singapore host.
6. Only after step 3 is confirmed in the console, set Worker variable `DASHSCOPE_FREE_QUOTA_ONLY_CONFIRMED=true` to unlock the API route. This variable does not replace or modify Alibaba's console setting.
7. In staging, sign in, save a task, and choose **Run AI Agent**. Check the model and token usage displayed with the result. Do not run this against sensitive company or employee data.

Official references:
- [OpenAI-compatible Chat API](https://docs.modelstudio.console.alibabacloud.com/en/model-studio/compatibility-of-openai-with-dashscope)
- [Get API Key](https://www.alibabacloud.com/help/en/model-studio/get-api-key)
- [Workspace ID](https://www.alibabacloud.com/help/en/model-studio/obtain-the-app-id-and-workspace-id)
- [Free quota and Free Quota Only](https://www.alibabacloud.com/help/en/model-studio/new-free-quota)

Free quota covers eligible real-time model invocations only; other Cloud resources or services can have separate charges. Protect keys server-side and avoid sending confidential information to external model providers.
