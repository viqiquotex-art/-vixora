import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const STAGING_URL = 'https://nuofddhqznewkkryejmu.supabase.co';
const STAGING_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJudW9mZGRocXpuZXdra3J5ZWptdSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzkyMzc5NzUwLCJleHAiOjIxMDc5NTU3NTB9.Wg7ClORTohR_Ps06x7aYTjFI5OdGm8MNqYAr-AfjurQ';

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  const token = typeof record.token === 'string' ? record.token : '';
  const decision = typeof record.decision === 'string' ? record.decision : '';
  if (!email || !token || !['approved', 'rejected'].includes(decision)) {
    return json({ error: 'Email, approval token, and decision are required.' }, { status: 400 });
  }
  try {
    const response = await fetch(`${STAGING_URL}/functions/v1/vixora-access-approval`, {
      method: 'POST',
      headers: { apikey: STAGING_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'review', email, token, decision }),
      signal: AbortSignal.timeout(12000)
    });
    const text = await response.text();
    let result: Record<string, unknown> = {};
    try { result = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch {}
    return json(result, { status: response.status, headers: { 'cache-control': 'no-store' } });
  } catch {
    return json({ error: 'Approval service is unavailable.' }, { status: 503 });
  }
};
