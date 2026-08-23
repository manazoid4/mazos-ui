import { expect, test } from '@playwright/test';

test('operator can move from a researched prospect to a saved call outcome', async ({ page }) => {
  const businessName = `Call Desk Test ${crypto.randomUUID().slice(0, 8)}`;
  const consoleProblems: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`);
  });

  await page.route('**/api/mazos/site-check', async route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ audit: {
      checkedAt: new Date().toISOString(), requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', reachable: true,
      statusCode: 200, durationMs: 420, score: 72, title: 'Example', summary: 'the homepage source does not expose a clear contact path',
      signals: { https: true, viewport: true, description: false, contactPath: false, form: false, callToAction: false },
      findings: [{ severity: 'high', label: 'Contact path unclear', evidence: 'the homepage source does not expose a clear contact, quote, booking, phone, or email path' }],
    } }),
  }));

  await page.goto('/call-desk');
  await expect(page.getByRole('heading', { name: 'CALL DESK' })).toBeVisible();
  await page.getByRole('button', { name: '+ Add' }).click();

  await page.getByLabel('Business name *').fill(businessName);
  await page.getByLabel('Phone *').fill('020 7946 0999');
  await page.getByLabel('Contact name / role').fill('the owner');
  await page.getByLabel('Website').fill('example.com');
  await page.getByLabel('Trade').fill('Test services');
  await page.getByLabel('Area').fill('London');
  await page.getByLabel('Source — where the public business details came from').fill('Public test fixture');
  await page.getByRole('button', { name: 'Save prospect' }).click();
  await expect(page.getByRole('status')).toContainText('Prospect saved');

  await page.getByRole('button', { name: 'Run website check' }).click();
  await expect(page.getByText('/ 100 signal score')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('status')).toContainText('Website evidence checked and saved');

  await page.locator('label').filter({ hasText: /^TPS/ }).locator('select').selectOption('clear');
  await page.locator('label').filter({ hasText: /^CTPS/ }).locator('select').selectOption('clear');
  await page.getByLabel('Maz Works suppression list').selectOption('clear');
  await page.getByLabel('Checked at').fill(new Date().toISOString().slice(0, 16));
  await page.getByRole('button', { name: 'Save prospect' }).click();
  await expect(page.getByText('Ready for a live call')).toBeVisible();

  await page.getByRole('button', { name: 'Open call script →' }).click();
  await expect(page.getByRole('heading', { name: 'Permission opener' })).toBeVisible();
  await expect(page.getByText('£150 Website Rescue Sprint')).toBeVisible();
  await page.getByLabel('Call notes').fill('Owner confirmed enquiries matter and asked for a screen-share.');
  await page.getByLabel('Outcome').selectOption('booked');
  await page.getByLabel('Next action').fill('Send calendar invite and evidence note');
  await page.getByLabel('Follow-up date').fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));
  await page.getByRole('button', { name: 'Save outcome + next call' }).click();

  await expect(page.getByRole('heading', { name: /logged call/ })).toBeVisible();
  await expect(page.getByText('Send calendar invite and evidence note').first()).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Call saved');
  expect(consoleProblems).toEqual([]);
});
