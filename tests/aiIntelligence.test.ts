import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractUrls,
  detectPlatform,
  detectSourceType,
  scoreUsefulness,
  suggestAction,
  suggestLoopPattern,
  isDuplicate,
  parsePaste,
  buildItem,
  type SourceItem,
} from '../src/lib/mazos/aiSourceInbox';
import { generateSkillSpec, categorize } from '../src/lib/mazos/skillFactory';
import { seedStarterPacks, packReadme, buildPack } from '../src/lib/mazos/loopStore';
import { computeTrust } from '../src/lib/mazos/trust';

test('extracts URLs from messy text', () => {
  const urls = extractUrls('check this https://github.com/foo/bar and also http://example.com.');
  assert.deepEqual(urls, ['https://github.com/foo/bar', 'http://example.com']);
});

test('classifies github, instagram, youtube platforms', () => {
  assert.equal(detectPlatform('https://github.com/foo/bar', ''), 'github');
  assert.equal(detectPlatform('https://instagram.com/reel/xyz', ''), 'instagram');
  assert.equal(detectPlatform('https://youtube.com/watch?v=1', ''), 'youtube');
  assert.equal(detectPlatform('', 'just a note'), 'local_note');
});

test('classifies github sub-types', () => {
  assert.equal(detectSourceType('github', 'https://github.com/a/b/issues/5', ''), 'issue');
  assert.equal(detectSourceType('github', 'https://github.com/a/b/pull/5', ''), 'pull_request');
  assert.equal(detectSourceType('github', 'https://github.com/a/b/blob/main/x.ts', ''), 'file');
  assert.equal(detectSourceType('github', 'https://github.com/a/b', ''), 'repo');
});

test('classifies instagram AI Feed note as ai_tool', () => {
  const type = detectSourceType('instagram', '', 'Reel about a cool new AI tool that controls tabs');
  assert.equal(type, 'ai_tool');
});

test('scores usefulness higher for keyword-rich github items', () => {
  const rich = scoreUsefulness({ sourcePlatform: 'github', sourceType: 'mcp_server', rawInput: 'MCP server for browser automation with memory and context', url: 'https://github.com/a/b' });
  const weak = scoreUsefulness({ sourcePlatform: 'unknown', sourceType: 'unknown', rawInput: 'hi', url: '' });
  assert.ok(rich > weak);
});

test('suggests actions from source type', () => {
  assert.equal(suggestAction({ sourceType: 'mcp_server', usefulnessScore: 80, sourcePlatform: 'github' }), 'make_skill');
  assert.equal(suggestAction({ sourceType: 'repo', usefulnessScore: 80, sourcePlatform: 'github' }), 'add_to_loop_factory');
  assert.equal(suggestAction({ sourceType: 'competitor', usefulnessScore: 80, sourcePlatform: 'website' }), 'add_to_competitor_radar');
  assert.equal(suggestAction({ sourceType: 'unknown', usefulnessScore: 10, sourcePlatform: 'unknown' }), 'ignore');
});

test('suggests loop patterns per category', () => {
  assert.equal(suggestLoopPattern({ sourcePlatform: 'github', sourceType: 'repo', rawInput: 'https://github.com/a/b' }), 'github-pulse');
  assert.equal(suggestLoopPattern({ sourcePlatform: 'website', sourceType: 'competitor', rawInput: 'competitor market research writeup' }), 'research-intelligence');
  assert.equal(suggestLoopPattern({ sourcePlatform: 'local_note', sourceType: 'research_note', rawInput: 'random scattered idea' }), 'founder-inbox');
});

test('dedupes by normalised url regardless of scheme/www/trailing slash', () => {
  const existing: SourceItem[] = [buildItem('note', 'https://www.github.com/a/b/', [])];
  assert.ok(isDuplicate({ url: 'http://github.com/a/b', rawInput: 'x' }, existing));
});

test('parsePaste splits URLs into items and groups note lines together', () => {
  const raw = 'https://github.com/foo/bar\nJust a random idea\nAnother note line';
  const { added, skippedDuplicates } = parsePaste(raw, []);
  assert.equal(skippedDuplicates, 0);
  assert.equal(added.length, 2); // one github item + one grouped note item
  assert.ok(added.some(i => i.sourcePlatform === 'github'));
  assert.ok(added.some(i => i.sourcePlatform === 'local_note'));
});

test('parsePaste skips duplicates against existing items', () => {
  const existing = parsePaste('https://github.com/foo/bar', []).added;
  const { added, skippedDuplicates } = parsePaste('https://github.com/foo/bar', existing);
  assert.equal(added.length, 0);
  assert.equal(skippedDuplicates, 1);
});

test('trust score rewards evidence and penalises duplicates/risk', () => {
  const clean = computeTrust({ sourceClarity: true, usefulness: 80, testable: true, hasEvidence: true, safetyRisk: 'low', isDuplicate: false, setupComplexity: 'low', humanGateRequired: true, lastVerifiedAt: new Date().toISOString() });
  const risky = computeTrust({ sourceClarity: false, usefulness: 20, testable: false, hasEvidence: false, safetyRisk: 'high', isDuplicate: true, setupComplexity: 'high', humanGateRequired: false });
  assert.ok(clean.trustScore > risky.trustScore);
  assert.equal(clean.trustLevel, 'approved');
  assert.equal(risky.trustLevel, 'untrusted');
});

test('generateSkillSpec categorizes and links back to source item', () => {
  const source = buildItem('MCP server for browser tab control', 'https://github.com/a/mcp-browser', []);
  const spec = generateSkillSpec({ sourceItem: source });
  assert.equal(categorize('mcp server for browser'), 'mcp');
  assert.equal(spec.category, 'mcp');
  assert.deepEqual(spec.sourceItemIds, [source.id]);
  assert.deepEqual(spec.sourceUrls, [source.url]);
  assert.equal(spec.status, 'draft');
});

test('seedStarterPacks creates the four packs once and is idempotent', () => {
  const once = seedStarterPacks([]);
  assert.equal(once.length, 4);
  assert.ok(once.some(p => p.name === 'Founder Command Pack'));
  const twice = seedStarterPacks(once);
  assert.equal(twice.length, 4); // no duplicates on re-seed
});

test('packReadme renders required sections', () => {
  const pack = buildPack({ name: 'Test Pack', description: 'desc', includedLoopIds: ['loop-a'] });
  const readme = packReadme(pack);
  for (const heading of ['## Name', '## Who it is for', '## Problem solved', '## Included loops', '## Setup', '## Safety limits', '## Proof / receipts', '## Why this is useful']) {
    assert.ok(readme.includes(heading), `missing ${heading}`);
  }
});
