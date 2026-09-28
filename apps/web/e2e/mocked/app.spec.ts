import { expect, test } from '@playwright/test';
import { addSessionCookie, installMockApi } from '../fixtures/mock-api';

test.beforeEach(async ({ page, context, baseURL }) => {
  await addSessionCookie(context, baseURL!);
  await installMockApi(page);
});

test('dashboard shows KPIs and my tasks with overdue highlighted', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('Active projects', { exact: true })).toBeVisible();
  const tasks = page.getByTestId('my-tasks');
  await expect(tasks.getByRole('link')).toHaveCount(4);
  await expect(tasks.getByText(/Overdue/).first()).toBeVisible();
});

test('task opens the project with the stage drawer', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByTestId('my-tasks').getByRole('link', { name: /Installation as per Schedule/ }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('heading', { name: 'Installation as per Schedule' })).toBeVisible();
});

test('completing a stage shows STAGE_RULE reasons, then succeeds once satisfied', async ({ page }) => {
  await page.goto('/projects/p0000000000000000000042?stage=installation');
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();

  await drawer.getByLabel('Completed on').fill('2026-09-28');
  await drawer.getByTestId('complete-stage').click();
  await expect(drawer.getByTestId('stage-rule-errors')).toContainText('All checklist items must be done');

  const unchecked = drawer.getByRole('checkbox', { checked: false });
  while ((await unchecked.count()) > 0) await unchecked.first().click();
  await drawer.getByTestId('complete-stage').click();
  await expect(drawer).toBeHidden();
  await expect(page.getByTestId('stage-card-installation')).toContainText('Completed');
  // Dependent stage unlocked by the engine.
  await expect(page.getByTestId('stage-card-site_photos')).toContainText('Ready');
});

test('project tabs are shown for enabled features', async ({ page }) => {
  await page.goto('/projects/p0000000000000000000042');
  for (const tab of ['Workflow', 'Documents', 'BOQ', 'Payments', 'Timeline']) {
    await expect(page.getByRole('tab', { name: new RegExp(`^${tab}`) })).toBeVisible();
  }
});
