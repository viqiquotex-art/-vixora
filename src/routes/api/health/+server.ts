import { json } from '@sveltejs/kit';

export function GET() {
  return json({
    ok: true,
    service: 'vixora-workspace-staging',
    version: '3.0.0',
    mode: 'staging',
    execution: 'not-connected'
  });
}
