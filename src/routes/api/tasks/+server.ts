import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

const DEFAULT_SUPABASE_URL = 'https://gdxughluqryzlklrnzhz.supabase.co';
// Publishable legacy anon key only; never use a service-role key in this route.
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkeHVnaGx1cXJ5emxrbHJuemh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjI0ODAsImV4cCI6MjEwMzEzODQ4MH0.YhQaMhH6gwhLZNVem9NR0Ow32iqrgcB3YiAi-WSBKMo';

function getConfig(platform: App.Platform | undefined) {
  const env = (platform?.env ?? {}) as Env;
  const url = (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  return { url, key };
}

function getBearer(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getAuthenticatedUserId(config: { url: string; key: string }, token: string) {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.key, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  return typeof user.id === 'string' ? user.id : null;
}

export const GET: RequestHandler = async ({ request, platform }) => {
  const config = getConfig(platform);
  const token = getBearer(request);
  if (!config) {
    return json({ error: 'Supabase is not configured for this environment.' }, { status: 503 });
  }
  if (!token) return json({ error: 'Sign in is required.' }, { status: 401 });

  const response = await fetch(
    `${config.url}/rest/v1/tasks?select=id,title,description,due_date,priority,completed,created_at&order=created_at.desc`,
    {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    }
  );

  const body = await response.text();
  if (!response.ok) {
    return json({ error: 'Could not load tasks.', detail: body.slice(0, 500) }, { status: response.status });
  }
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
};

export const POST: RequestHandler = async ({ request, platform }) => {
  const config = getConfig(platform);
  const token = getBearer(request);
  if (!config) {
    return json({ error: 'Supabase is not configured for this environment.' }, { status: 503 });
  }
  if (!token) return json({ error: 'Sign in is required.' }, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!input || typeof input !== 'object') {
    return json({ error: 'A task object is required.' }, { status: 400 });
  }
  const record = input as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const description = typeof record.description === 'string' ? record.description.trim() : null;
  const priority = record.priority === 'low' || record.priority === 'high' ? record.priority : 'medium';

  if (title.length < 1 || title.length > 240) {
    return json({ error: 'Task title must contain 1–240 characters.' }, { status: 400 });
  }
  if (description && description.length > 12000) {
    return json({ error: 'Task description is too long.' }, { status: 400 });
  }

  // Resolve the account from Supabase Auth; never trust user_id supplied by the browser.
  const userId = await getAuthenticatedUserId(config, token);
  if (!userId) return json({ error: 'Session is invalid or expired. Please sign in again.' }, { status: 401 });

  // The user's access token is forwarded to Supabase; RLS still determines ownership.
  // Never use a service-role key here.
  const response = await fetch(`${config.url}/rest/v1/tasks`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      user_id: userId,
      title,
      description,
      priority,
      completed: false
    })
  });

  const body = await response.text();
  if (!response.ok) {
    return json({ error: 'Task could not be saved. Check the session and row-level security policies.', detail: body.slice(0, 500) }, { status: response.status });
  }
  return new Response(body, {
    status: 201,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
};
