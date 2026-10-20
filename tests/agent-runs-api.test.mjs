import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST, PATCH } from '../src/routes/api/agent-runs/+server.ts';

const endpoint = 'https://staging.example/api/agent-runs';
const token = 'test-user-access-token';

function request(method, { auth = true, body, rawBody } = {}) {
  const headers = new Headers();
  if (auth) headers.set('Authorization', `Bearer ${token}`);
  if (body !== undefined || rawBody !== undefined) headers.set('Content-Type', 'application/json');
  return new Request(endpoint, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(rawBody !== undefined ? { body: rawBody } : {})
  });
}

function upstream(payload, status = 200, contentType = 'application/json') {
  return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
    status,
    headers: { 'content-type': contentType }
  });
}

test('Agent Run API transport contract', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  await t.test('rejects requests without a bearer token before contacting storage', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return upstream({ runs: [] }); };
    const response = await GET({ request: request('GET', { auth: false }) });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'Sign in is required.');
    assert.equal(calls, 0);
  });

  await t.test('GET forwards the user token and returns non-cacheable run history', async () => {
    const expected = { runs: [{ id: 'run-1', status: 'succeeded' }], storageReady: true };
    let captured;
    globalThis.fetch = async (url, init) => {
      captured = { url, init };
      return upstream(expected);
    };

    const response = await GET({ request: request('GET') });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(captured.url, /functions\/v1\/agent-run-storage$/);
    assert.equal(captured.init.method, 'GET');
    assert.equal(captured.init.headers.get('Authorization'), `Bearer ${token}`);
    assert.match(captured.init.headers.get('apikey'), /^sb_publishable_/);
  });

  await t.test('POST validates JSON before forwarding a run request', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return upstream({ run: { id: 'run-2' } }, 201); };

    const response = await POST({ request: request('POST', { rawBody: '{invalid-json' }) });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Request body must be valid JSON.');
    assert.equal(calls, 0);
  });

  await t.test('POST forwards the request body and preserves storage status', async () => {
    const body = { task_id: 'c16a6b91-4b59-4a79-9a17-4cb0af38b38d', run_kind: 'ai' };
    let captured;
    globalThis.fetch = async (_url, init) => {
      captured = init;
      return upstream({ run: { id: 'run-3', status: 'running' }, storageReady: true }, 201);
    };

    const response = await POST({ request: request('POST', { body }) });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { run: { id: 'run-3', status: 'running' }, storageReady: true });
    assert.equal(captured.method, 'POST');
    assert.deepEqual(JSON.parse(captured.body), body);
    assert.equal(captured.headers.get('Authorization'), `Bearer ${token}`);
    assert.equal(captured.headers.get('Content-Type'), 'application/json');
  });

  await t.test('PATCH preserves explicit storage failures rather than reporting success', async () => {
    globalThis.fetch = async () => upstream({
      error: 'Could not update staging agent run.'
    }, 502);

    const response = await PATCH({
      request: request('PATCH', {
        body: { run_id: 'c16a6b91-4b59-4a79-9a17-4cb0af38b38d', status: 'failed' }
      })
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, 'Could not update staging agent run.');
  });

  await t.test('invalid JSON returned by storage becomes an explicit 502', async () => {
    globalThis.fetch = async () => upstream('not-json', 200, 'text/plain');

    const response = await GET({ request: request('GET') });
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const payload = await response.json();
    assert.equal(payload.error, 'AGENT_RUN_STORAGE_INVALID_RESPONSE');
    assert.equal(payload.storageReady, false);
  });

  await t.test('storage network failures become an explicit unavailable response', async () => {
    globalThis.fetch = async () => { throw new Error('simulated network failure'); };

    const response = await GET({ request: request('GET') });
    assert.equal(response.status, 502);
    const payload = await response.json();
    assert.equal(payload.error, 'AGENT_RUN_STORAGE_UNAVAILABLE');
    assert.equal(payload.storageReady, false);
  });
});
