import { expect, test } from '@playwright/test';
import { DEFAULT_STAGES, PHASES } from '@solar/shared';

test.describe('Landing page', () => {
  test('explains the product and the 7-phase workflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Run your solar business from');
    await expect(page.getByRole('link', { name: 'Start free trial' }).first()).toBeVisible();

    const phases = page.getByRole('tablist', { name: 'Workflow phases' });
    await expect(phases.getByRole('tab')).toHaveCount(PHASES.length);

    // Selecting a phase shows its stages from the shared workflow definition.
    const logistics = PHASES.find((p) => p.key === 'logistics')!;
    await phases.getByRole('tab', { name: new RegExp(logistics.name) }).click();
    const panel = page.locator('#phase-panel');
    for (const s of DEFAULT_STAGES.filter((d) => d.phase === 'logistics')) {
      await expect(panel.getByText(s.name, { exact: true })).toBeVisible();
    }
  });

  test('role explainer lists the stages a role owns', async ({ page }) => {
    await page.goto('/#roles');
    await page.getByRole('tab', { name: 'Project Engineer' }).click();
    await expect(page.getByText('Installation as per Schedule').first()).toBeVisible();
  });

  test('navigates to pricing and register', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Plans');
    await expect(page.getByText('Most popular')).toBeVisible();
    await page.getByRole('link', { name: 'Start free trial' }).nth(1).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: 'Create your organisation' })).toBeVisible();
  });

  test('works at phone width without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
  });
});
