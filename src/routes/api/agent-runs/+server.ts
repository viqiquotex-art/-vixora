import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const STORAGE_URL = 'https://nuofddhqznewkkryejmu.supabase.co/functions/v1/agent-run-storage';
const STORAGE_PUBLISHABLE_KEY = 'sb_publishable_U3J8wBprqpGtq7-17XKmoA_OTGB0Bqp';

function hasBearer(request: Request): boolean {
  return /^Bearer\s+.+$/i.test(request.headers.get('authorization') ?? '');
}

async function forward(request: Request, method: 'GET' | 'POST' | 'PATCH') {
  if (!hasBearer(request)) {
    return json({ error: 'Sign in is required.' }, { status: 401 });
  }

  const headers = new Headers({
    apikey: STORAGE_PUBLISHABLE_KEY,
    Authorization: request.headers.get('authorization') ?? '',
    Accept: 'application/json'
  });
  let body: string | undefined;
  if (method !== 'GET') {
    headers.set('Content-Type', 'application/json');
    try {
      body = JSON.stringify(await request.json());
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
  }

  try {
    const response = await fetch(STORAGE_URL, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(12000)
    });
    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      return json({
        storageReady: false,
        error: 'AGENT_RUN_STORAGE_INVALID_RESPONSE',
        message: 'Database staging Agent Run mengembalikan respons yang tidak valid.'
      }, { status: 502, headers: { 'cache-control': 'no-store' } });
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return json({
        storageReady: false,
        error: 'AGENT_RUN_STORAGE_INVALID_RESPONSE',
        message: 'Database staging Agent Run mengembalikan format respons yang tidak valid.'
      }, { status: 502, headers: { 'cache-control': 'no-store' } });
    }
    return json(payload, {
      status: response.status,
      headers: { 'cache-control': 'no-store' }
    });
  } catch {
    return json({
      storageReady: false,
      error: 'AGENT_RUN_STORAGE_UNAVAILABLE',
      message: 'Database staging Agent Run belum dapat dihubungi. Permintaan ini tidak diarahkan ke database produksi.'
    }, { status: 502 });
  }
}

export const GET: RequestHandler = ({ request }) => forward(request, 'GET');
export const POST: RequestHandler = ({ request }) => forward(request, 'POST');
export const PATCH: RequestHandler = ({ request }) => forward(request, 'PATCH');
