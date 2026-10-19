-- Agent Run History for VIXORA STAGING only.
-- Apply to the separate project vixora-staging-agent-runs (nuofddhqznewkkryejmu).
-- The active VIXORA auth + tasks live in another Supabase project, so user_id/task_id
-- intentionally have no foreign keys into this project's auth.users/public.tasks.
-- Only the server-side agent-run-storage Edge Function may access this table.
create extension if not exists pgcrypto;

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  task_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 240),
  prompt text not null check (char_length(trim(prompt)) between 1 and 12000),
  status text not null default 'planned'
    check (status in ('planned', 'queued', 'planning', 'awaiting_approval', 'running', 'succeeded', 'failed', 'cancelled')),
  assigned_agent text,
  executor text not null default 'not_connected',
  external_run_id text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  requires_approval boolean not null default true,
  approved_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_runs_user_created_idx on public.agent_runs (user_id, created_at desc);
create index if not exists agent_runs_status_created_idx on public.agent_runs (status, created_at desc);
create index if not exists agent_runs_task_created_idx on public.agent_runs (task_id, created_at desc);

alter table public.agent_runs enable row level security;
revoke all on public.agent_runs from anon, authenticated;
grant all on public.agent_runs to service_role;

create or replace function public.set_agent_runs_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_runs_updated_at on public.agent_runs;
create trigger agent_runs_updated_at
  before update on public.agent_runs
  for each row execute function public.set_agent_runs_updated_at();

comment on table public.agent_runs is 'Isolated VIXORA staging agent-run history. All reads/writes are server-side through the agent-run-storage Edge Function after validating the token against the separate VIXORA auth project.';
