-- DRAFT ONLY: do not apply to the connected production Supabase project yet.
-- This creates an agent execution record, separate from public.tasks (the existing
-- personal task list). Apply only after staging auth/API acceptance tests are ready.

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  prompt text not null check (char_length(trim(prompt)) between 1 and 12000),
  status text not null default 'queued'
    check (status in ('queued', 'planning', 'awaiting_approval', 'running', 'succeeded', 'failed', 'cancelled')),
  assigned_agent text,
  executor text,
  external_run_id text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  requires_approval boolean not null default false,
  approved_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_runs_user_created_idx
  on public.agent_runs (user_id, created_at desc);

create index if not exists agent_runs_status_created_idx
  on public.agent_runs (status, created_at desc);

alter table public.agent_runs enable row level security;

drop policy if exists "Users can view their own agent runs" on public.agent_runs;
create policy "Users can view their own agent runs"
  on public.agent_runs for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own agent runs" on public.agent_runs;
create policy "Users can create their own agent runs"
  on public.agent_runs for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own agent runs" on public.agent_runs;
create policy "Users can delete their own agent runs"
  on public.agent_runs for delete to authenticated
  using (auth.uid() = user_id);

-- Intentionally no authenticated UPDATE policy:
-- status/output/executor metadata must be changed through an authenticated,
-- server-side Worker endpoint, never trusted directly from the browser.
revoke update on public.agent_runs from authenticated;
