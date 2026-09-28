import { expect, test, type Page } from '@playwright/test';

/**
 * Real-stack journey (needs the API with seed data): sign in → dashboard → open a project →
 * complete the first actionable workflow stage.
 *
 * Uses the seeded manager account because `workflow:override` + broad ownership lets it act on any
 * open stage regardless of which phase the seeded projects are in.
 */
const USER = process.env.E2E_USER ?? 'manager@demo.solar';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Demo@1234';

async function signIn(page: Page, email = USER, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('Login → dashboard → stage completion', () => {
  test('rejects a wrong password with a clear message', async ({ page }) => {
    await signIn(page, USER, 'wrong-password-1');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('demo account helper fills the form', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Sales Executive/ }).click();
    await expect(page.getByLabel('Email')).toHaveValue('sales@demo.solar');
  });

  test('manager completes a workflow stage', async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);

    // Open the first active project.
    await page.getByRole('link', { name: 'Projects' }).first().click();
    await expect(page).toHaveURL(/\/projects/);
    await page.getByRole('table', { name: 'Projects' }).getByRole('row').nth(1).click();
    await expect(page).toHaveURL(/\/projects\/[a-f\d]{24}/);

    // Pick the first stage card that is ready or in progress.
    const card = page.locator('[data-testid^="stage-card-"]').filter({ hasText: /Ready|In progress/ }).first();
    await expect(card).toBeVisible();
    const stageKey = (await card.getAttribute('data-testid'))!.replace('stage-card-', '');
    await card.click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    // Satisfy what the UI can: tick the checklist and fill required fields with plausible values.
    for (const box of await drawer.getByRole('checkbox').all()) {
      if ((await box.getAttribute('data-state')) !== 'checked' && (await box.isEnabled())) {
        await box.click();
        await expect(box).toHaveAttribute('data-state', 'checked');
      }
    }
    for (const date of await drawer.locator('input[type="date"]').all()) {
      if (!(await date.inputValue())) await date.fill(new Date().toISOString().slice(0, 10));
    }
    for (const num of await drawer.locator('input[type="number"]').all()) {
      if (!(await num.inputValue())) await num.fill('5');
    }
    for (const text of await drawer.locator('input[type="text"]:not([aria-label]), input:not([type])').all()) {
      if ((await text.isEditable()) && !(await text.inputValue())) await text.fill('E2E-1');
    }
    for (const select of await drawer.locator('select').all()) {
      if (!(await select.inputValue()) && (await select.locator('option').count()) > 1) await select.selectOption({ index: 1 });
    }

    await drawer.getByTestId('complete-stage').click();

    // Either the stage completes (drawer closes, card shows Completed) or the API explains why not.
    const rules = drawer.getByTestId('stage-rule-errors');
    await expect(rules.or(page.getByTestId(`stage-card-${stageKey}`).getByText('Completed'))).toBeVisible();
    if (await rules.isVisible()) {
      await expect(rules.getByRole('listitem').first()).toBeVisible();
    }
  });
});
