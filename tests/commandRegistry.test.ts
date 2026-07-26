import test from 'node:test';
import assert from 'node:assert/strict';
import { actions } from '../src/lib/mazos/commandRegistry';

const byId = (id: string) => actions().find(a => a.id === id);

test('AI review action exists and runs open-code-review non-interactively', () => {
  const review = byId('review_mazos');
  assert.ok(review, 'review_mazos action is missing');
  assert.equal(review.handler, 'command');
  assert.equal(review.command, 'ocr');
  // Machine-readable + no progress spam: a loop consumes this output, not a human.
  assert.deepEqual(review.args, ['review', '--format', 'json', '--audience', 'agent']);
});

test('dogfood action is a prompt handler, not a fake mechanical gate', () => {
  const dogfood = byId('dogfood_mazos');
  assert.ok(dogfood, 'dogfood_mazos action is missing');
  // Exploratory QA needs an agent driving a browser; no single command returns a
  // trustworthy pass/fail, so it must not present itself as a verify gate.
  assert.equal(dogfood.handler, 'prompt');
  assert.notEqual(dogfood.category, 'Verify');
  assert.match(dogfood.fallbackPrompt, /3046/, 'must target the local cockpit port');
});
