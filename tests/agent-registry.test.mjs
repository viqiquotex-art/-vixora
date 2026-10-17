import test from 'node:test';
import assert from 'node:assert/strict';
import { routeTaskToAgent, AGENT_REGISTRY } from '../src/lib/server/agent-registry.ts';

test('registry includes expected initial specialist roles', () => {
  assert.deepEqual(
    AGENT_REGISTRY.map((agent) => agent.id),
    ['content-studio', 'research-agent', 'workflow-planner', 'strategy-planner']
  );
});

test('routes short-form content requests to Content Studio', () => {
  assert.equal(routeTaskToAgent('Buat 5 ide YouTube Shorts dan hook').id, 'content-studio');
  assert.equal(routeTaskToAgent('Write a script for a short video').id, 'content-studio');
});

test('routes research requests to Research Agent', () => {
  assert.equal(routeTaskToAgent('Riset 5 kompetitor dan bandingkan sumbernya').id, 'research-agent');
  assert.equal(routeTaskToAgent('Compare these options and summarize analysis').id, 'research-agent');
});

test('routes automation requests to Workflow Planner', () => {
  assert.equal(routeTaskToAgent('Buat workflow n8n untuk memproses formulir').id, 'workflow-planner');
  assert.equal(routeTaskToAgent('Integrasi webhook untuk otomasi approval').id, 'workflow-planner');\n  assert.equal(routeTaskToAgent('Webhook untuk kirim hasil form tanpa konten video').id, 'workflow-planner');
});

test('uses Strategy & Planner for generic tasks', () => {
  assert.equal(routeTaskToAgent('Buat rencana kerja mingguan').id, 'strategy-planner');
});

test('normalizes Unicode text consistently', () => {
  assert.equal(routeTaskToAgent('ＲＩＳＥＴ daftar vendor').id, 'research-agent');
});
