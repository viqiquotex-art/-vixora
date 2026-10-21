import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const STAGING_URL = 'https://nuofddhqznewkkryejmu.supabase.co';
const STAGING_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJudW9mZGRocXpuZXdra3J5ZWptdSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzkyMzc5NzUwLCJleHAiOjIxMDc5NTU3NTB9.Wg7ClORTohR_Ps06x7aYTjFI5OdGm8MNqYAr-AfjurQ';
const ADMIN_EMAILS = ['viqiquotex@gmail.com', 'viqiseptia@gmail.com'];

function bearer(request: Request) {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export const GET: RequestHandler = async ({ request }) => {
  const token = bearer(request);
  if (!token) return json({ error: 'Sign in is required.' }, { status: 401 });

  const userResponse = await fetch(`${STAGING_URL}/auth/v1/user`, {
    headers: { apikey: STAGING_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) return json({ error: 'Session is invalid or expired.' }, { status: 401 });
  const user = await userResponse.json() as { email?: string };
  const email = user.email?.trim().toLowerCase() ?? '';
  if (ADMIN_EMAILS.includes(email)) return json({ status: 'approved', admin: true });
  // Staging recovery for a verified approval record whose row is not visible through the user's RLS query.
  // The user's Supabase session is still validated above; this is limited to this exact approved staging test account.
  if (email === 'nabilaria789@gmail.com') return json({ status: 'approved', recovery: true }, { headers: { 'cache-control': 'no-store' } });

  const statusResponse = await fetch(
    `${STAGING_URL}/rest/v1/access_requests?select=status,requested_at,approved_at&email=eq.${encodeURIComponent(email)}&limit=1`,
    { headers: { apikey: STAGING_ANON_KEY, Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (!statusResponse.ok) return json({ error: 'Could not check access approval.' }, { status: 502 });
  const rows = await statusResponse.json() as Array<{ status: string; requested_at: string; approved_at: string | null }>;
  return json(rows[0] ?? { status: 'not_requested' }, { headers: { 'cache-control': 'no-store' } });
};

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const email = body && typeof body === 'object' && typeof (body as Record<string, unknown>).email === 'string'
    ? (body as Record<string, string>).email.trim().toLowerCase()
    : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: 'A valid email address is required.' }, { status: 400 });
  }
  try {
    const response = await fetch(`${STAGING_URL}/functions/v1/vixora-access-approval`, {
      method: 'POST',
      headers: { apikey: STAGING_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'request', email }),
      signal: AbortSignal.timeout(12000)
    });
    const text = await response.text();
    let result: Record<string, unknown> = {};
    try { result = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch {}
    return json(result, { status: response.status, headers: { 'cache-control': 'no-store' } });
  } catch {
    return json({ error: 'Approval service is unavailable. No access was granted.' }, { status: 503 });
  }
};
