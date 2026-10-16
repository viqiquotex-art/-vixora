# VIXORA Architecture Decision Record — Full Redesign

**Status:** Accepted direction; implementation not yet started  
**Date:** 2026-10-16  
**Decision:** Replace the current React/Vite-first architecture rather than treating it as a constraint. Preserve useful integrations only after they pass tests.

## Product direction

VIXORA is an AI work system, not an animated chat demo. The primary product should let a user submit work, inspect which specialist was selected, follow execution status, review outputs/evidence, and manage integrations safely.

The current "Command Center" is not sacred. Replace it with **VIXORA Workspace** (working name): a functional dashboard with:
- New Task / natural-language task intake
- Task runs and status history
- Agent roster and capabilities
- Results and evidence
- Integrations and secrets-status indicators (never show secret values)
- Approvals for high-impact actions
- Settings and usage/limits

Do not build decorative animation before the task lifecycle and execution contract work.

## Recommended stack

### Application: SvelteKit + TypeScript
- One full-stack application instead of keeping React/Vite only because it exists.
- SvelteKit pages and server routes handle the workspace UI and API routes.
- Use official Cloudflare adapter and deploy to Cloudflare Workers.
- Use a small, responsive UI with progressive enhancement; animation is optional and should not drive architecture.

Official deployment guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/

### Runtime and hosting: Cloudflare Workers
- Deploy the app and server-side routes to Workers, mapped to the existing custom domain after staging tests.
- Prefer Workers for a new deployment rather than building the new app around GitHub Pages.
- Use Workers secrets for provider keys.
- Keep GitHub Actions for checks/build/deploy automation where useful.

Official guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/

### Identity and persistence: Supabase (initially)
- Reuse the existing Supabase project only after inspecting its schema, Auth settings, and RLS policies.
- Supabase Auth for identity; Postgres for users, tasks, task events, agent runs, and output metadata.
- Enforce ownership in server-side authorization and RLS; never rely on hiding UI controls.
- Do not migrate/delete existing tables until the new app is tested.

### Agent orchestration: purpose-built TypeScript modules
- A versioned agent registry defines IDs, capabilities, allowed tools, inputs, output schema, and risk.
- A deterministic router selects supported capabilities; model-based classification may be added behind a validated interface.
- A task lifecycle tracks received, validated, routed, queued, running, succeeded, failed, and needs_review.
- Bounded retries apply only to retryable transient failures.
- Quality checks require evidence; don't mark a task successful merely because a provider accepted the request.
- Do not add a heavyweight agent framework before core behavior and provider contracts are tested.

### Execution adapters
- **CREAO:** keep as a temporary adapter for currently working workflows. Confirm the API contract, key configuration, and end-to-end run status before treating it as reliable.
- **n8n:** use as an external workflow runtime, not as part of the frontend build. Connect through authenticated webhooks or API only after the deployment and test workflow are confirmed.
- **LLM provider:** define a provider interface so models can be switched; keep API keys server-side.
- Add further tools only through explicit adapters with schemas, timeouts, permission checks, and audit events.

### Storage and background work
- Start with Supabase Postgres for durable task metadata and results.
- Use Cloudflare Queues/Workflows or a separate n8n runtime only when actual asynchronous/retry needs justify them. Don't introduce infrastructure without a tested requirement.
- Do not assume Cloudflare Workers can host a persistent n8n process.

## Why not Astro as the main app?
Astro is excellent for public, content-heavy marketing pages with little client-side JavaScript. VIXORA's main product is an authenticated, interactive task workspace, so SvelteKit is the better single-framework starting point. A separate Astro marketing site can be considered later if public SEO/content becomes a major need; it is not required for v1.

## Target architecture

```
Browser
  |
  v
SvelteKit Workspace + server endpoints
  |-- Supabase Auth / Postgres (identity, task history, metadata)
  |-- Orchestrator (registry, router, lifecycle, policy)
  |-- CREAO adapter (existing workflows, only after verification)
  |-- n8n adapter (external runtime, after verified setup)
  |-- LLM/tool adapters (server-side secrets and explicit permissions)
  |
  v
Normalized run status + outputs + evidence + audit events
```

## Security baseline
- Keep all provider secrets in server-side environment bindings/secrets.
- Verify user sessions on every private task endpoint and check resource ownership.
- Validate request size, schema, intent, and tool permissions.
- Add rate limits, timeouts, safe error mapping, and audit metadata.
- Require explicit approval before publish/send/payment/delete/production changes.
- Do not execute arbitrary code, shell commands, or arbitrary user-supplied URLs.
- Review existing Supabase RLS and deployment secrets before reusing them.
- Never include secrets in logs or API responses.

## Migration strategy (no big-bang production cutover)

### Stage 0 — Inventory and safety
- [ ] Inspect the complete current repo, deployment workflow, Worker routes, Supabase schema/RLS, CREAO behavior, and domain configuration.
- [ ] Capture current production behavior and a rollback point.
- [ ] Keep current site available during the new app build.

### Stage 1 — New app skeleton
- [ ] Scaffold SvelteKit + TypeScript using the official Cloudflare adapter.
- [ ] Add CI build/type checks.
- [ ] Deploy to a staging Worker URL; do not switch the custom domain yet.
- [ ] Add a simple health route and smoke tests.

### Stage 2 — Workspace UI
- [ ] Build a clean, responsive Workspace with task intake, run list, agent roster, result detail, and settings.
- [ ] Use mocked data first; do not pretend mock runs are real execution.
- [ ] Add accessible loading, empty, failure, and needs-review states.

### Stage 3 — Identity and task storage
- [ ] Verify current Supabase Auth and schema before reuse.
- [ ] Add task/run tables and RLS only after a schema review.
- [ ] Test cross-user access denial.

### Stage 4 — Orchestrator core
- [ ] Implement agent registry, deterministic routing, task state machine, and structured task envelope.
- [ ] Add request validation, idempotency where supported, timeouts, and bounded retries.
- [ ] Add evidence-backed completion checks and unit tests.

### Stage 5 — Connect real executors
- [ ] Verify CREAO using a safe, low-impact test workflow.
- [ ] Add n8n only after a reachable, authenticated test webhook and complete status response are confirmed.
- [ ] Keep failed/unconfigured adapters disabled and report their status honestly.

### Stage 6 — QA and cutover
- [ ] Run mobile/desktop, auth, routing, API, failure, and authorization tests.
- [ ] Confirm custom-domain DNS and Worker routing plan.
- [ ] Cut over only after staging passes; retain a documented rollback path.

## Definition of done for v1
1. User can sign in and create a task.
2. Router selects a known agent/capability and explains the routing decision.
3. Run status persists and can be refreshed without losing progress.
4. Real executor status is normalized; unconfigured/failed integrations never appear successful.
5. Results and evidence are attached to the run.
6. Private task history is inaccessible to other users.
7. Retry count is bounded; high-impact actions require approval.
8. The app builds and deploys reproducibly to Cloudflare Workers.
9. The existing production site is not replaced until staging tests pass.

## Current status / caveat

This ADR records the recommended architecture and migration plan. It does not mean the new SvelteKit app has been scaffolded, Supabase tables changed, the domain moved, or CREAO/n8n verified. The next implementation action is Stage 0 inventory, then create the new app in a separate branch or directory and deploy to staging.
