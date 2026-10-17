import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgentDryRun } from '../src/lib/server/agent-runtime.ts';

const cases = [
  { title: 'Buat ide YouTube Shorts tentang kopi', expected: 'content-studio' },
  { title: 'Riset dan bandingkan supplier panel', expected: 'research-agent' },
  { title: 'Buat workflow n8n untuk approval', expected: 'workflow-planner' },
  { title: 'Buat rencana kerja kuartal depan', expected: 'strategy-planner' }
];

test('every specialist produces a useful local dry-run preview', () => {
  for (const item of cases) {
    const preview = runAgentDryRun({ title: item.title, description: item.title, priority: 'medium' });
    assert.equal(preview.agentId, item.expected);
    assert.equal(preview.status, 'preview_ready');
    assert.equal(preview.mode, 'local-template-dry-run');
    assert.equal(preview.externalExecutorCalls, 0);
    assert.equal(preview.executor, 'none');
    assert.ok(preview.summary.length > 20);
    assert.ok(preview.steps.length >= 4);
    assert.ok(preview.deliverables.length >= 2);
    assert.ok(preview.nextAction.length > 10);
    assert.ok(preview.limitations.some((line) => line.includes('Tidak memakai model AI')));
  }
});

test('research dry-run never claims that real sources were gathered', () => {
  const preview = runAgentDryRun({ title: 'Riset 5 opsi software dan bandingkan sumber' });
  assert.equal(preview.agentId, 'research-agent');
  assert.match(preview.summary, /Belum ada penelusuran web/);
  assert.ok(preview.deliverables.some((line) => line.includes('Matriks bukti')));
});

test('workflow dry-run explicitly avoids changing or triggering external workflows', () => {
  const preview = runAgentDryRun({ title: 'Integrasi webhook dengan n8n' });
  assert.equal(preview.agentId, 'workflow-planner');
  assert.match(preview.summary, /belum dibuat atau dijalankan/);
  assert.ok(preview.limitations.some((line) => line.includes('Tidak memanggil CREAO, n8n')));
});
