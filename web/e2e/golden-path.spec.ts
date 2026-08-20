import { test, expect } from '@playwright/test';

// Critical happy path per docs/test-strategy-restoledger.md §5 (release gate: "E2E happy path
// passes ... and is recorded"). Covers: register -> create tenant -> post entry -> dashboard
// reflects it -> reverse entry -> audit log records both actions.
test('owner registers, creates a tenant, posts and reverses a ledger entry', async ({ page }) => {
  const unique = Date.now();
  const email = `owner-e2e-${unique}@test.com`;

  await page.goto('/login');
  await page.getByRole('tab', { name: 'Register' }).click();
  await page.getByLabel('Full name').fill('Amine Owner');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correcthorsebattery');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByPlaceholder('Restaurant name').fill('Cafe E2E');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Cafe E2E')).toBeVisible();

  await page.getByRole('link', { name: 'Ledger' }).click();
  await page.getByRole('button', { name: 'Post entry' }).click();
  await page.getByLabel('Amount (MAD)').fill('420.50');
  await page.getByLabel('Note (optional)').fill('Lunch service');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText('420.50 MAD')).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByText('420.50 MAD').first()).toBeVisible();

  await page.getByRole('link', { name: 'Ledger' }).click();
  await page.getByRole('button', { name: 'Reverse' }).click();
  await page.getByLabel('Reason').fill('Entered twice by mistake');
  await page.getByRole('button', { name: 'Reverse entry' }).click();
  await expect(page.getByText('-420.50 MAD')).toBeVisible();

  await page.getByRole('link', { name: 'Audit Log' }).click();
  await expect(page.getByText('ledger_entry.create')).toBeVisible();
  await expect(page.getByText('ledger_entry.reverse')).toBeVisible();
});
