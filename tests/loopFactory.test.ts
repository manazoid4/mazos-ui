import test from 'node:test';
import assert from 'node:assert/strict';
import { customLoopId, generateLoopDraft } from '../src/lib/mazos/loopFactory';

test('a loop with a verify action and real repo passes the gate', () => {
  const draft = generateLoopDraft({
    goal: 'Ship one lead-to-paid conversion fix on /find-jobs and verify with build',
    repo: 'mazos_ui',
    verifyActionId: 'verify_mazos',
    agent: 'Claude',
  });
  assert.equal(draft.def.repo, 'mazos_ui');
  assert.deepEqual(draft.def.verifyActionIds, ['verify_mazos']);
  assert.equal(draft.def.autonomy, 'branch');
  assert.match(draft.def.promptTemplate, /exactly ONE unchecked item/);
  assert.equal(draft.gate.blockers.length, 0);
});

test('no verify action blocks the gate and locks autonomy to suggest', () => {
  const draft = generateLoopDraft({ goal: 'Make things better somehow', repo: 'mazos_ui' });
  assert.equal(draft.def.autonomy, 'suggest');
  assert.equal(draft.gate.approved, false);
  assert.ok(draft.gate.blockers.some(b => b.includes('verify action')));
});

test('unknown repo key blocks the gate', () => {
  const draft = generateLoopDraft({ goal: 'Fix the thing', repo: 'nonexistent_repo', verifyActionId: 'verify_mazos' });
  assert.ok(draft.gate.blockers.some(b => b.includes('does not resolve')));
});

test('customLoopId is stable and namespaced', () => {
  const id = customLoopId('JobFilter', 'Research competitors');
  assert.equal(id, customLoopId('JobFilter', 'Research competitors'));
  assert.match(id, /^custom_/);
});
