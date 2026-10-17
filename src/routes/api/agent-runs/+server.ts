import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { routeTaskToAgent } from '$lib/server/agent-registry';

type Env = { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };
type SupabaseConfig = { url: string; key: string };

const DEFAULT_SUPABASE_URL = 'https://gdxughluqryzlklrnzhz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkeHVnaGx1cXJ5emxrbHJuemh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjI0ODAsImV4cCI6MjEwMzEzODQ4MH0.YhQaMhH6gwhLZNVem9NR0Ow32iqrgcB3YiAi-WSBKMo';

function getConfig(platform: App.Platform | undefined): SupabaseConfig {
  const env = (platform?.env ?? {}) as Env;
  return {
    url: (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, ''),
    key: env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  };
}

function getBearer(request: Request): string | null {
  const match = (request.headers.get('authorization') ?? '').match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getUserId(config: SupabaseConfig, token: string): Promise<string | null> {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.key, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  return typeof user.id === 'string' ? user.id : null;
}

function isMissingRunTable(body: string): boolean {
  const normalized = body.toLowerCase();
  return normalized.includes('pgrst205')
    || (normalized.includes('agent_runs') && (normalized.includes('schema cache') || normalized.includes('does not exist')));
}

function migrationNotReady() {
  return json({
    storageReady: false,
    error: 'Agent-run storage is not installed in the staging database yet.',
    message: 'The agent_runs migration remains a draft because staging currently shares a Supabase project with production. No production schema change was applied.'
  }, { status: 503 });
}

export const GET: RequestHandler = async ({ request, platform }) => {
  const config = getConfig(platform);
  const token = getBearer(request);
  if (!token) return json({ error: 'Sign in is required.' }, { status: 401 });

  const userId = await getUserId(config, token);
  if (!userId) return json({ error: 'Session is invalid or expired. Please sign in again.' }, { status: 401 });

  const response = await fetch(
    `${config.url}/rest/v1/agent_runs?select=id,task_id,title,prompt,status,assigned_agent,executor,output,error_message,attempt_count,requires_approval,created_at,updated_at&order=created_at.desc&limit=50`,
    { headers: { apikey: config.key, Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  const body = await response.text();
  if (!response.ok) {
    if (isMissingRunTable(body)) return json({ runs: [], storageReady: false, message: 'Run history needs the isolated staging agent_runs schema.' });
    return json({ error: 'Could not load agent runs.' }, { status: response.status });
  }
  return json({ runs: JSON.parse(body), storageReady: true }, { headers: { 'cache-control': 'no-store' } });
};

export const POST: RequestHandler = async ({ request, platform }) => {
  const config = getConfig(platform);
  const token = getBearer(request);
  if (!token) return json({ error: 'Sign in is required.' }, { status: 401 });

  let input: unknown;
  try { input = await request.json(); }
  catch { return json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  if (!input || typeof input !== 'object' || typeof (input as Record<string, unknown>).task_id !== 'string') {
    return json({ error: 'task_id is required.' }, { status: 400 });
  }
  const taskId = (input as Record<string, string>).task_id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId)) {
    return json({ error: 'task_id must be a UUID.' }, { status: 400 });
  }

  const userId = await getUserId(config, token);
  if (!userId) return json({ error: 'Session is invalid or expired. Please sign in again.' }, { status: 401 });

  const taskResponse = await fetch(
    `${config.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,title,description,priority&limit=1`,
    { headers: { apikey: config.key, Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (!taskResponse.ok) return json({ error: 'Could not verify task ownership.' }, { status: taskResponse.status });
  const taskRows = await taskResponse.json() as Array<{ id: string; title: string; description: string | null; priority: string }>;
  const task = taskRows[0];
  if (!task) return json({ error: 'Task was not found for this account.' }, { status: 404 });

  const agent = routeTaskToAgent(`${task.title}\n${task.description ?? ''}`);
  const prompt = (task.description?.trim() || task.title).slice(0, 12000);
  const planRecord = {
    user_id: userId,
    task_id: task.id,
    title: task.title.slice(0, 240),
    prompt,
    status: 'planned',
    assigned_agent: agent.id,
    executor: 'not_connected',
    input: { source: 'task_center', router: 'vixora-deterministic-router-v1', priority: task.priority },
    output: {
      mode: 'plan-only',
      agent_name: agent.name,
      message: 'Agent selected and run plan recorded. No external executor has been called.',
      capabilities: agent.capabilities
    },
    requires_approval: true
  };

  const response = await fetch(`${config.url}/rest/v1/agent_runs`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      Accept: 'application/json'
    },
    body: JSON.stringify(planRecord)
  });
  const body = await response.text();
  if (!response.ok) {
    if (isMissingRunTable(body)) return migrationNotReady();
    return json({ error: 'Could not create agent run plan.' }, { status: response.status });
  }
  const rows = JSON.parse(body) as Array<Record<string, unknown>>;
  if (!rows[0]) return json({ error: 'Run plan was not returned by the database.' }, { status: 502 });
  return json({ run: rows[0], storageReady: true }, { status: 201, headers: { 'cache-control': 'no-store' } });
};
