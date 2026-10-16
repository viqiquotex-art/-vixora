# VIXORA staging — Supabase task API setup

This API is deliberately limited to the existing personal task list (`public.tasks`). It is **not** the AI execution lifecycle; agent orchestration will use the separate `public.agent_runs` schema after auth/API acceptance checks.

## Worker variables

Configure these variables only on the staging Worker `vixora-workspace-staging`:

- `SUPABASE_URL`: `https://gdxughluqryzlklrnzhz.supabase.co`
- `SUPABASE_ANON_KEY`: Supabase publishable key (`sb_publishable_...`) or legacy anon key.

Do not use a service-role key. The API forwards the user's Supabase access token to PostgREST so existing Row Level Security policies determine which records can be read or inserted. Never accept `user_id` from a client request.

## API contract

- `GET /api/tasks`: returns the signed-in user's task rows, newest first.
- `POST /api/tasks`: body `{ "title": "...", "description": "...", "priority": "low|medium|high" }`; inserts a personal task and returns the created row.
- Both routes require `Authorization: Bearer <Supabase access token>`.
- Missing configuration returns `503`; missing session returns `401`; validation failures return `400`.

## Verification before UI wiring

1. Confirm the staging Worker has the two variables above.
2. Sign in through the eventual Supabase auth UI and obtain a valid access token.
3. Verify GET/POST only expose rows owned by that user.
4. Do not apply `202610160001_agent_runs.sql` to the existing Supabase project until the staging auth/API checks pass.
5. Keep `vixora.my.id` and its production Worker untouched.
