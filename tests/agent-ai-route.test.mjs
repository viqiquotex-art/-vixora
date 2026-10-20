import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../src/routes/api/agent-ai/+server.ts';

const taskId = 'c16a6b91-4b59-4a79-9a17-4cb0af38b38d';
const token = 'test-user-access-token';

function request({ auth = true, task_id = taskId } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (auth) headers.set('Authorization', `Bearer ${token}`);
  return new Request('https://staging.example/api/agent-ai', {
    method: 'POST',
    headers,
    body: JSON.stringify({ task_id })
  });
}

function platformEnv(overrides = {}) {
  return {
    SUPABASE_URL: 'https://auth.example.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_FREE_TIER_ONLY_CONFIRMED: 'true',
    ...overrides
  };
}

function upstream(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function mockSuccessfulFetch(t, { model = 'gemini-3.6-flash', modelResponse } = {}) {
  const originalFetch = globalThis.fetch;
  const captured = { modelUrl: null, requestBody: null };
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith('/auth/v1/user')) {
      assert.equal(new Headers(init.headers).get('Authorization'), `Bearer ${token}`);
      return upstream({ id: '8efb5e37-9e17-4fb1-91c4-75b4ecf394a1', email: 'test@example.com' });
    }
    if (url.includes('/rest/v1/tasks?')) {
      return upstream([{
        id: taskId,
        title: 'hai',
        description: null,
        priority: 'medium'
      }]);
    }
    if (url.includes('generativelanguage.googleapis.com')) {
      captured.modelUrl = url;
      captured.requestBody = JSON.parse(init.body);
      assert.equal(new Headers(init.headers).get('x-goog-api-key'), 'test-gemini-key');
      return modelResponse ?? upstream({
        candidates: [{ content: { parts: [{ text: 'Halo dari test Gemini.' }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7, totalTokenCount: 12 }
      });
    }
    throw new Error(`Unexpected fetch URL in test: ${url}`);
  };
  return captured;
}

test('AI route uses the low-latency default model and returns its answer', async (t) => {
  const captured = mockSuccessfulFetch(t);
  const response = await POST({
    request: request(),
    platform: { env: platformEnv() }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.result.answer, 'Halo dari test Gemini.');
  assert.equal(payload.result.model, 'gemini-3.6-flash');
  assert.match(captured.modelUrl, /models\/gemini-3\.6-flash:generateContent$/);
  assert.equal(captured.requestBody.generationConfig.thinkingConfig.thinkingLevel, 'low');
});

test('AI route accepts an explicit model override from staging configuration', async (t) => {
  const captured = mockSuccessfulFetch(t, { model: 'gemini-3.8-flash' });
  const response = await POST({
    request: request(),
    platform: { env: platformEnv({ GEMINI_MODEL: 'gemini-3.8-flash' }) }
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.model, 'gemini-3.8-flash');
  assert.match(captured.modelUrl, /models\/gemini-3\.8-flash:generateContent$/);
});

test('AI route rejects a missing bearer token before contacting the model', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return upstream({}); };

  const response = await POST({
    request: request({ auth: false }),
    platform: { env: platformEnv() }
  });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'Sign in is required.');
  assert.equal(calls, 0);
});
