# VIXORA Agency Agents — NEXUS Adaptation Plan

**Status:** Architecture proposal / implementation backlog  
**Repository:** `viqiquotex-art/-vixora`  
**Reference:** `msitarzewski/agency-agents` (MIT-licensed reference repository)  
**Goal:** Adapt the useful coordination patterns from Agency Agents/NEXUS to VIXORA without replacing the existing UI or breaking the current CREAO integration.

## 1. Current VIXORA baseline (observed)

- Frontend: React + Vite; primary UI in `src/App.jsx`; styling in `src/agency.css`.
- Authentication: Supabase client used by the frontend.
- Backend entry point: `worker.js`, intended for Cloudflare Workers.
- Existing API routes: `GET /api/health`, `POST /api/command`, and `GET /api/command/:runId`.
- Current executor: CREAO App Runs API; API key is read from the Cloudflare Worker secret `CREAO_API_KEY`.
- Current visible agent catalog includes Content, YouTube, Research, Creative, Automation, and VIXORA Orchestrator.
- Current command routing contains a simple content-intent branch and sends other commands to the executor. This is a useful prototype, not yet a complete multi-agent runtime.

## 2. Design principles borrowed from NEXUS

1. **One source of truth:** define each agent, its capabilities, inputs, outputs, and permitted tools in a single registry.
2. **Explicit task routing:** classify the user's request and route it to a supported capability; do not claim an action ran unless the executor confirms it.
3. **Context-preserving handoffs:** every delegated task carries the request, relevant context, constraints, acceptance criteria, and expected output format.
4. **Evidence-based quality gates:** mark a task complete only when a verifiable result or executor status supports that conclusion.
5. **Bounded retries:** retry transient failures at most three times, with backoff; do not repeatedly retry validation, permission, or configuration errors.
6. **Least privilege:** keep provider keys in Worker secrets; never expose secrets in frontend code, logs, or task history.
7. **Incremental delivery:** keep the current interface and CREAO route working while adding orchestration in small, testable steps.

## 3. Proposed VIXORA architecture

```
React Command Center
        |
        v
Cloudflare Worker (/api/*)
  - request validation
  - authentication/authorization checks
  - intent classification and routing
  - run status + safe error mapping
        |
        v
Orchestrator / Task Router
  - agent registry
  - task envelope
  - capability and policy checks
  - execution state
        |
        +--> CREAO API (existing executor)
        +--> n8n webhook/API (only after configured)
        +--> future tools/adapters
        |
        v
Result normalization + evidence + audit metadata
        |
        v
Command Center status and final result
```

Important: the diagram is a target design, not a claim that all these modules already exist. Cloudflare Workers should remain the lightweight API/orchestration edge; long-running n8n hosting belongs on a separate runtime such as the planned Oracle Cloud VM, not inside a static frontend build.

## 4. Initial agent roster

Start with a small roster that matches VIXORA's existing use cases.

| Agent | Responsibility | Initial execution |
|---|---|---|
| Orchestrator | Classify request, select capability, manage status and handoff | Worker routing logic |
| Content Agent | Ideas, scripts, captions, Shorts packages | Existing content branch, then model/executor-backed |
| YouTube Agent | YouTube workflow requests | Existing CREAO executor path where supported |
| Research Agent | Research/summarization requests | Executor-backed; do not fabricate live research |
| Creative Agent | Visual concepts and generation prompts | Executor-backed or prompt output |
| Automation Agent | Workflow design and automation requests | CREAO now; n8n only when endpoint is configured |
| QA / Reality Checker | Check output against acceptance criteria | Deterministic checks first; model-based review later |

Each agent should have a stable ID, display name, description, supported intents, executor adapter, required inputs, output schema, and risk level. An agent definition alone does not grant it new tools or autonomous execution.

## 5. Standard task envelope

Use a consistent internal shape for routed work:

```json
{
  "taskId": "server-generated-id",
  "source": "vixora-command-center",
  "requestedAgent": "auto",
  "intent": "content.create",
  "command": "user's original request",
  "context": {},
  "acceptanceCriteria": [],
  "status": "queued",
  "attempt": 1,
  "createdAt": "ISO-8601 timestamp"
}
```

This is a conceptual schema. Validate all client input and generate IDs/timestamps on the server; never trust a client-provided status or attempt count.

Suggested lifecycle:
`received → validated → routed → running → succeeded | failed | needs_review`

## 6. Quality gates and retry policy

- **Gate A — Input:** non-empty command, bounded length, valid JSON, authenticated user when required.
- **Gate B — Routing:** selected agent must exist and advertise the requested capability.
- **Gate C — Execution:** executor response must be parsed and checked; preserve provider run IDs for status polling.
- **Gate D — Result:** output must match the expected shape; return clear status and safe error details.
- **Gate E — Completion:** only show success when the executor or deterministic local path confirms completion.

Retry policy:
- Retry network/time-out/HTTP 429 and selected 5xx errors, with exponential backoff and jitter.
- Do not retry 400/401/403, invalid input, missing secrets, or unsupported routes automatically.
- Maximum three attempts for retryable failures, then return `needs_review`/failure with a diagnostic request ID.
- Avoid duplicate side effects by using idempotency keys when the provider supports them.

## 7. Security and reliability checklist

- Keep `CREAO_API_KEY` exclusively in Cloudflare Worker secrets.
- Add authentication and authorization checks to command and status endpoints before exposing user-specific runs.
- Restrict CORS to known VIXORA origins, but do not treat CORS as authentication.
- Validate command length and JSON shape; normalize provider errors without leaking secrets or sensitive upstream response bodies.
- Add request IDs, timeouts, rate limits, and safe structured logs.
- Never execute arbitrary shell/code or arbitrary URLs supplied in a user command.
- Confirm Supabase Row Level Security and ownership checks for any stored tasks or results.
- Add an explicit approval step before actions that publish content, send messages, spend money, delete data, or change production infrastructure.

## 8. Implementation phases

### Phase 0 — Baseline and contract
- [ ] Confirm current production Worker deployment and route behavior.
- [ ] Record current request/response examples for health, command creation, and run polling.
- [ ] Add tests for valid input, empty input, malformed JSON, unknown route, missing secret, upstream error, and status polling.
- **Exit gate:** current supported flow has repeatable tests and a rollback point.

### Phase 1 — Registry and deterministic routing
- [ ] Create a server-side agent registry with stable IDs and supported intents.
- [ ] Move intent classification out of the large request handler into a small routing module.
- [ ] Preserve existing route names and CREAO API contract.
- [ ] Return the chosen agent and routing reason in safe response metadata.
- **Exit gate:** each supported sample request routes predictably; unknown requests return an honest unsupported/needs-review response.

### Phase 2 — Run state and handoffs
- [ ] Define a normalized task envelope and result schema.
- [ ] Preserve provider run IDs and normalize queued/running/succeeded/failed states.
- [ ] Add handoff metadata and bounded retry policy for retryable failures only.
- [ ] Decide whether run history belongs in Supabase, with user ownership and RLS.
- **Exit gate:** a run can be followed from submission to final status without falsely reporting success.

### Phase 3 — QA / Reality Checker
- [ ] Define acceptance criteria per agent capability.
- [ ] Add deterministic output validation before model-based evaluation.
- [ ] Produce evidence-backed PASS/FAIL/NEEDS_REVIEW reports.
- **Exit gate:** failed or incomplete work is not represented as completed.

### Phase 4 — n8n adapter
- [ ] Deploy n8n separately on the chosen host.
- [ ] Configure a secret webhook/API endpoint and authentication.
- [ ] Add an adapter only after a test workflow succeeds end-to-end.
- [ ] Keep CREAO as the existing executor until the n8n route is verified.
- **Exit gate:** a test workflow succeeds, reports its run status, and handles timeout/failure safely.

### Phase 5 — UI status and operations
- [ ] Show selected agent, run state, and clear error/retry messages in the Command Center.
- [ ] Add run history only after authorization and retention rules are defined.
- [ ] Add operational metrics: success rate, first-attempt success, retries, duration, and blocked tasks.
- **Exit gate:** user-facing state matches backend state.

## 9. Minimum acceptance tests

1. `GET /api/health` returns service status without exposing secrets.
2. Empty or malformed command is rejected with HTTP 400.
3. A valid supported request is routed to the expected agent.
4. Missing `CREAO_API_KEY` returns a clear configuration error without leaking credentials.
5. Upstream non-2xx responses are surfaced as safe failures, not success.
6. A known run ID can be polled and returns normalized status.
7. An unknown run ID or unsupported route returns a safe error.
8. A timeout cannot leave the UI claiming a successful result.
9. Unauthorized users cannot poll another user's run if user-specific history is enabled.
10. Retry limits prevent unbounded duplicate executions.

## 10. Non-goals for the first release

- Do not copy every agent in the reference repository.
- Do not add a multi-agent framework dependency before the basic routing contract is tested.
- Do not replace CREAO or change production DNS/deployment as part of the initial registry work.
- Do not promise autonomous browser, shell, publishing, or n8n execution unless the required tool is actually configured and permissioned.

## 11. Reference links

- Agency Agents repository: https://github.com/msitarzewski/agency-agents
- Agents Orchestrator: https://github.com/msitarzewski/agency-agents/blob/main/specialized/agents-orchestrator.md
- NEXUS strategy: https://github.com/msitarzewski/agency-agents/blob/main/strategy/nexus-strategy.md
- NEXUS quick start: https://github.com/msitarzewski/agency-agents/blob/main/strategy/QUICKSTART.md
- Handoff templates: https://github.com/msitarzewski/agency-agents/blob/main/strategy/coordination/handoff-templates.md

---
This plan is an implementation guide. It does not itself deploy code, configure secrets, create n8n infrastructure, or verify production behavior.
