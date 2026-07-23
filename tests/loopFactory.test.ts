import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { customLoopId, generateLoopDraft } from '../src/lib/mazos/loopFactory';

test('a loop with a verify action and existing repo passes the gate', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'mazos-loop-factory-'));
  try {
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
      name: 'loop-factory-test-repo',
      private: true,
      scripts: { build: 'node -e "process.exit(0)"' },
    }), 'utf8');

    const draft = generateLoopDraft({
      goal: 'Ship one lead-to-paid conversion fix on /find-jobs and verify with build',
      repo: 'mazos_ui',
      verifyActionId: 'verify_mazos',
      agent: 'Claude',
    }, {
      resolveRepoPath: () => repo,
    });

    assert.equal(draft.def.repo, 'mazos_ui');
    assert.deepEqual(draft.def.verifyActionIds, ['verify_mazos']);
    assert.equal(draft.def.autonomy, 'branch');
    assert.match(draft.def.promptTemplate, /exactly ONE unchecked item/);
    assert.equal(draft.gate.blockers.length, 0);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
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
