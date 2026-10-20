import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type ExecutionEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_FREE_TIER_ONLY_CONFIRMED?: string;
};

export const GET: RequestHandler = ({ platform }) => {
  const env = (platform?.env ?? {}) as ExecutionEnv;
  const geminiKeyConfigured = Boolean(env.GEMINI_API_KEY?.trim());
  const freeTierGateEnabled = env.GEMINI_FREE_TIER_ONLY_CONFIRMED?.trim().toLowerCase() === 'true';
  const executionConfigured = geminiKeyConfigured && freeTierGateEnabled;

  return json({
    ok: true,
    service: 'vixora-workspace-staging',
    version: '3.0.0',
    mode: 'staging',
    // This describes Worker configuration only; it is not a live request to Gemini.
    execution: executionConfigured ? 'configured' : 'not-configured',
    executionProbe: 'configuration-only',
    checks: {
      provider: 'google-gemini',
      apiKey: geminiKeyConfigured ? 'configured' : 'missing',
      freeTierGate: freeTierGateEnabled ? 'enabled' : 'blocked'
    }
  }, {
    headers: { 'cache-control': 'no-store' }
  });
};
