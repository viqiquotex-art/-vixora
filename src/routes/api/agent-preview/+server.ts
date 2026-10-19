import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runAgentDryRun } from '$lib/server/agent-runtime';

type Env = { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };
type SupabaseConfig = { url: string; key: string };
type TaskRow = { id: string; title: string; description: string | null; priority: string | null };

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
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

async function hasValidSession(config: SupabaseConfig, token: string): Promise<boolean> {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.key, Authorization: `Bearer ${token}` }
  });
  return response.ok;
}

export const POST: RequestHandler = async ({ request, platform }) => {
  const token = getBearer(request);
  if (!token) return json({ error: 'Sign in is required.' }, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!input || typeof input !== 'object' || typeof (input as Record<string, unknown>).task_id !== 'string') {
    return json({ error: 'task_id is required.' }, { status: 400 });
  }
  const taskId = (input as Record<string, string>).task_id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId)) {
    return json({ error: 'task_id must be a UUID.' }, { status: 400 });
  }

  const config = getConfig(platform);
  if (!(await hasValidSession(config, token))) {
    return json({ error: 'Session is invalid or expired. Please sign in again.' }, { status: 401 });
  }

  // The user's access token is forwarded; Supabase RLS proves ownership without service-role privileges.
  const response = await fetch(
    `${config.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,title,description,priority&limit=1`,
    { headers: { apikey: config.key, Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (!response.ok) {
    return json({ error: 'Could not load the task for preview.' }, { status: response.status });
  }

  const rows = await response.json() as TaskRow[];
  const task = rows[0];
  if (!task) return json({ error: 'Task was not found for this account.' }, { status: 404 });

  // Deliberately local-only: no CREAO, n8n, model provider, or other executor is called.
  const preview = runAgentDryRun(task);
  return json({ preview }, { status: 200, headers: { 'cache-control': 'no-store' } });
};
