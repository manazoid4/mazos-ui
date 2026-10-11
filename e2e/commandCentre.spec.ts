import { expect, test } from '@playwright/test';

test('command centre shows real API-backed information without fictional agent activity', async ({ page }) => {
  await page.route('**/api/mazos/shipping-spine', r => r.fulfill({ json: {
    generatedAt: '2026-10-11T00:00:00Z',
    verdict: { product: 'Maz Works', action: 'Review Zawiya preview', why: 'A real client-facing milestone', owner: 'Maz' },
    rows: [{ product: 'Maz Works', productId: 'mazworks', nextAction: 'Review Zawiya preview',
      objective: 'Client-ready demo', commercialReason: 'Convert real enquiries', blocker: '',
      blocked: false, owner: 'Maz', safety: 'L1', score: 37,
      handoffPrompt: 'Review the demo safely', github: null, branch: null, dirty: 0, actionSource: 'repo-evidence' }] } }));
  await page.route('**/api/mazos/decisions', r => r.fulfill({ json: { decisions: [] } }));
  await page.route('**/api/mazos/repos', r => r.fulfill({ json: { repos: [{ id: 'mazos', label: 'MazOS', exists: true, branch: 'main', dirty: false, unpushedCount: 0, lastCommitIso: null, github: '' }] } }));
  await page.route('**/api/mazos/runs?*', r => r.fulfill({ json: { runs: [] } }));
  await page.route('**/api/mazos/health', r => r.fulfill({ json: { services: [] } }));
  await page.route('**/api/mazos/agent-directory', r => r.fulfill({ json: { local: true, agents: [
    { id: 'claude-a', label: 'Claude · Account A', purpose: 'Build', harness: 'Claude Code', device: 'Windows', state: 'unverified', evidence: 'slot only', observedAt: null },
    { id: 'claude-b', label: 'Claude · Account B', purpose: 'Review', harness: 'Claude Code', device: 'Windows', state: 'unverified', evidence: 'slot only', observedAt: null },
    { id: 'hermes:ilm', label: 'ILM', purpose: 'Research', harness: 'Hermes', device: 'Windows', state: 'profile-detected', evidence: 'profile directory', observedAt: new Date().toISOString() }
  ] } }));
  const writes: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET' && r.url().includes('/api/mazos/')) writes.push(r.url()); });
  await page.goto('/command-center');
  await expect(page.getByRole('heading', { name: /command centre/i })).toBeVisible();
  await expect(page.getByText('Review Zawiya preview').first()).toBeVisible();
  await expect(page.getByText('Claude · Account A')).toBeVisible();
  await expect(page.getByText('Claude · Account B')).toBeVisible();
  await expect(page.getByText('Profile detected').first()).toBeVisible();
  await page.getByLabel('Mission instruction').fill('Audit the Zawiya demo');
  await expect(page.getByRole('button', { name: /Copy mission for Codex/ })).toBeVisible();
  expect(writes).toEqual([]);
});

test('command centre has an explicit offline state', async ({ page }) => {
  await page.route('**/api/mazos/**', r => r.fulfill({ status: 503, json: { error: 'Backend unavailable' } }));
  await page.goto('/command-center');
  await expect(page.getByText('Partial / offline data')).toBeVisible();
  await expect(page.getByText(/Some local sources could not be read/)).toBeVisible();
  await expect(page.getByText(/No project priority available/)).toBeVisible();
});
