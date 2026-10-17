-- DRAFT ONLY: do not apply to the connected Supabase project used by production.
-- Apply only to an isolated staging database after its URL/keys have been configured.
-- This records agent execution plans separately from public.tasks (personal task list).

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
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
grant select, insert, delete on public.agent_runs to authenticated;

drop policy if exists "Users can view their own agent runs" on public.agent_runs;
create policy "Users can view their own agent runs"
  on public.agent_runs for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own agent runs" on public.agent_runs;
create policy "Users can create their own agent runs"
  on public.agent_runs for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      task_id is null
      or exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())
    )
  );

drop policy if exists "Users can delete their own agent runs" on public.agent_runs;
create policy "Users can delete their own agent runs"
  on public.agent_runs for delete to authenticated
  using (auth.uid() = user_id);

-- Browsers cannot directly edit status, output, attempts, or executor metadata.
revoke update on public.agent_runs from authenticated;

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
