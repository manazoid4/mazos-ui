import test from 'node:test';
import assert from 'node:assert/strict';
import { callReadiness, normalizeProspect, statusForOutcome } from '../src/lib/mazos/callDesk';
import { analyseWebsiteHtml, isPrivateAddress, normalizeWebsiteUrl } from '../src/lib/mazos/websiteAudit';

function prospect() {
  return normalizeProspect({
    businessName: 'Example Joinery', phone: '020 7946 0000', source: 'Public website',
    websiteAudit: analyseWebsiteHtml('https://example.com/', 'https://example.com/', 200, 200, '<html><head><title>Example</title><meta name="viewport" content="width=device-width"><meta name="description" content="A useful example business description"></head><body><a href="/contact">Contact us</a></body></html>'),
  });
}

test('a prospect is blocked until all three call screens are current and clear', () => {
  const item = prospect();
  assert.equal(callReadiness(item).ready, false);
  item.screening = { tps: 'clear', ctps: 'clear', ownList: 'clear', checkedAt: new Date().toISOString(), note: '' };
  assert.deepEqual(callReadiness(item), { ready: true, reasons: [] });
});

test('registered or suppressed numbers cannot become call-ready', () => {
  const item = prospect();
  item.screening = { tps: 'registered', ctps: 'clear', ownList: 'blocked', checkedAt: new Date().toISOString(), note: '' };
  const result = callReadiness(item);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.some(reason => reason.includes('TPS registered')));
  assert.ok(result.reasons.some(reason => reason.includes('do-not-call')));
});

test('do-not-call outcomes map to permanent suppression status', () => {
  assert.equal(statusForOutcome('do_not_call'), 'do_not_call');
  assert.equal(statusForOutcome('booked'), 'booked');
});

test('website input is normalized and private address ranges are rejected by classification', () => {
  assert.equal(normalizeWebsiteUrl('example.com').toString(), 'https://example.com/');
  assert.equal(isPrivateAddress('127.0.0.1'), true);
  assert.equal(isPrivateAddress('192.168.1.10'), true);
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('::1'), true);
  assert.equal(isPrivateAddress('::ffff:7f00:1'), true);
  assert.equal(isPrivateAddress('::ffff:172.16.0.1'), true);
});

test('specific consent needs an evidence note before the call gate opens', () => {
  const item = prospect();
  item.screening = { tps: 'consented', ctps: 'clear', ownList: 'clear', checkedAt: new Date().toISOString(), note: '' };
  assert.equal(callReadiness(item).ready, false);
  item.screening.note = 'Owner requested a call on 20 August 2026 via the website form.';
  assert.equal(callReadiness(item).ready, true);
});

test('website evidence is deterministic and ranks missing conversion paths', () => {
  const audit = analyseWebsiteHtml('http://example.com/', 'http://example.com/', 200, 350, '<html><head><title>Example</title></head><body><h1>Welcome</h1></body></html>');
  assert.equal(audit.signals.https, false);
  assert.equal(audit.signals.contactPath, false);
  assert.ok(audit.findings.some(finding => finding.label === 'No HTTPS'));
  assert.ok(audit.findings.some(finding => finding.label === 'Contact path unclear'));
  assert.ok(audit.score < 60);
});
