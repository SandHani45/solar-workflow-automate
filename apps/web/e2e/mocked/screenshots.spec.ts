import { test, type Page } from '@playwright/test';
import { addSessionCookie, installMockApi } from '../fixtures/mock-api';

/**
 * Regenerates docs/screenshots (run with SCREENSHOTS=1 pnpm test:e2e:mocked).
 * Authenticated screens use the in-browser API mock.
 */
test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to regenerate docs/screenshots');

const OUT = 'docs/screenshots';
const MAX_HEIGHT = 2600;

/** Full-page capture capped in height to keep the committed PNGs small. */
async function shoot(page: Page, path: string, full: boolean) {
  if (!full) return page.screenshot({ path });
  const { width, height } = await page.evaluate(() => ({ width: window.innerWidth, height: document.documentElement.scrollHeight }));
  return page.screenshot({ path, fullPage: true, clip: { x: 0, y: 0, width, height: Math.min(height, MAX_HEIGHT) } });
}
const SIZES = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
] as const;

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const [name, path] of [
      ['landing', '/'],
      ['pricing', '/pricing'],
      ['login', '/login?reauth=1'],
    ] as const) {
      test(name, async ({ page }) => {
        await page.goto(path, { waitUntil: 'networkidle' });
        await shoot(page, `${OUT}/${name}-${size.name}.png`, name !== 'login' || size.name === 'mobile');
      });
    }

    test('dashboard', async ({ page, context, baseURL }) => {
      await addSessionCookie(context, baseURL!);
      await installMockApi(page);
      await page.goto('/dashboard', { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await shoot(page, `${OUT}/dashboard-${size.name}.png`, true);
    });

    test('project-workflow', async ({ page, context, baseURL }) => {
      await addSessionCookie(context, baseURL!);
      await installMockApi(page);
      await page.goto('/projects/p0000000000000000000042', { waitUntil: 'networkidle' });
      await shoot(page, `${OUT}/project-workflow-${size.name}.png`, size.name === 'desktop');
    });

    test('stage-drawer', async ({ page, context, baseURL }) => {
      await addSessionCookie(context, baseURL!);
      await installMockApi(page);
      await page.goto('/projects/p0000000000000000000042?stage=installation', { waitUntil: 'networkidle' });
      await page.getByRole('dialog').waitFor();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/stage-drawer-${size.name}.png` });
    });
  });
}
