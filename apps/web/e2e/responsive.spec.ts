import { expect, test, type Page } from '@playwright/test';

/**
 * Real-stack responsiveness guard (needs the API with seed data): no page may scroll
 * horizontally at phone, tablet or laptop widths. Wide content such as tables must
 * scroll inside its own container instead of widening the page.
 */
const WIDTHS = [320, 375, 768, 1024];
const PUBLIC_PAGES = ['/', '/pricing', '/login', '/register', '/forgot-password'];
const APP_PAGES = [
  '/dashboard', '/leads', '/projects', '/projects/new', '/quotations', '/quotations/new', '/documents',
  '/inventory', '/inventory/movements', '/inventory/summary', '/dispatches', '/finance', '/finance/payments',
  '/finance/expenses', '/finance/advances', '/finance/partners', '/service', '/service/amc', '/reports',
  '/team', '/team/roles', '/settings', '/settings/features', '/settings/workflow', '/notifications', '/profile',
];
const USER = process.env.E2E_OWNER ?? 'owner@demo.solar';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Demo@1234';

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe('No horizontal page scroll', () => {
  for (const width of WIDTHS) {
    test(`public pages at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of PUBLIC_PAGES) {
        await page.goto(path, { waitUntil: 'networkidle' });
        expect.soft(await horizontalOverflow(page), `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });

    test(`app pages at ${width}px`, async ({ page }) => {
      test.setTimeout(120_000);
      const login = await page.request.post('/api/v1/auth/login', { data: { email: USER, password: PASSWORD } });
      expect(login.ok(), 'seeded owner can sign in').toBe(true);
      const projects = (await (await page.request.get('/api/v1/projects?limit=1')).json()).data as { id: string }[];
      const leads = (await (await page.request.get('/api/v1/leads?limit=1')).json()).data as { id: string }[];
      const detail = [projects[0] && `/projects/${projects[0].id}`, leads[0] && `/leads/${leads[0].id}`].filter(Boolean) as string[];

      await page.setViewportSize({ width, height: 900 });
      for (const path of [...APP_PAGES, ...detail]) {
        await page.goto(path, { waitUntil: 'networkidle' });
        expect.soft(await horizontalOverflow(page), `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});
