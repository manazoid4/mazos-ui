import test from 'node:test';
import assert from 'node:assert/strict';
import { customLoopId, generateLoopDraft, scoreLoopReadiness } from '../src/lib/mazos/loopFactory';

test('generates a ready competitor intelligence loop from a plain-English goal', () => {
  const draft = generateLoopDraft({
    goal: 'Research JobFilter competitors weekly and turn what works into product moves',
    project: 'JobFilter',
    pattern: 'auto',
    sources: ['https://example.com/competitor', 'intake queue'],
  });

  assert.equal(draft.pattern, 'research-intelligence');
  assert.equal(draft.def.agent, 'Hermes');
  assert.equal(draft.def.safetyCeiling, 'L1');
  assert.match(draft.def.name, /Competitor Intelligence/i);
  assert.match(draft.def.promptTemplate, /ideas to steal/i);
  assert.match(draft.def.successCondition, /ranked product move/i);
  assert.ok(draft.def.humanGates.some((gate) => gate.toLowerCase().includes('auth')));
  assert.ok(draft.evidenceRequired.some((item) => item.toLowerCase().includes('source')));
  assert.equal(draft.readiness, 'ready');
  assert.ok(draft.readinessScore >= 80);
});

test('scores vague loops as needing review', () => {
  const score = scoreLoopReadiness({
    goal: 'Make things better',
    sources: [],
    successCondition: '',
    humanGates: [],
    evidenceRequired: [],
    maxIterations: 12,
    budgetMinutes: 180,
    safetyCeiling: 'L3',
    pattern: 'research-intelligence',
  });

  assert.equal(score.readiness, 'unsafe');
  assert.ok(score.score < 50);
  assert.ok(score.warnings.length >= 4);
});

test('customLoopId is stable and namespaced', () => {
  const id = customLoopId('JobFilter', 'Research competitors');
  assert.equal(id, customLoopId('JobFilter', 'Research competitors'));
  assert.match(id, /^custom_/);
});
