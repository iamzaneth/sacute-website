import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const phase = process.argv[2];
if (!['before', 'after'].includes(phase))
  throw new Error('Use before or after');
const directory = `docs/ui-ux/screenshots/${phase}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const errors = [];
const consoleErrors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error')
    consoleErrors.push({ text: message.text(), url: message.location().url });
});
await page.addInitScript(() => {
  window.__uiAuditCLS = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      if (!entry.hadRecentInput) window.__uiAuditCLS += entry.value;
  }).observe({ type: 'layout-shift', buffered: true });
});
const metrics = [];
const routes = [
  '/',
  '/information',
  '/scholarships',
  '/events',
  '/contact',
  '/recruitment',
  '/unknown-ui-audit',
];
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const response = await page.goto(`http://127.0.0.1:4173${route}`);
      await page.locator('h1').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const name = route === '/' ? 'home' : route.slice(1);
      metrics.push({
        width,
        route,
        status: response.status(),
        ...(await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          heading: document.querySelector('h1')?.textContent,
          sidebar: getComputedStyle(document.querySelector('.sidebar'))
            .backgroundColor,
          initialLoadCLS: window.__uiAuditCLS,
        }))),
      });
      if (
        (route === '/' && [390, 768, 1440].includes(width)) ||
        (['/contact', '/recruitment'].includes(route) &&
          [390, 1440].includes(width)) ||
        (route === '/information' && width === 1440) ||
        (phase === 'after' && [390, 1440].includes(width))
      ) {
        await page.screenshot({
          path: `${directory}/${name}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/');
  await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
  await page.screenshot({ path: `${directory}/drawer-390.png` });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:4173/recruitment#academics');
    const detail = page.locator('#academics[open]');
    await detail.waitFor();
    await detail.screenshot({
      path: `${directory}/team-expanded-${width}.png`,
    });
  }
  const unexpectedConsoleErrors = consoleErrors.filter(
    (error) => !error.url.endsWith('/unknown-ui-audit'),
  );
  await writeFile(
    `docs/ui-ux/${phase}-metrics.json`,
    JSON.stringify({ metrics, errors, consoleErrors }, null, 2) + '\n',
  );
  console.log(
    JSON.stringify(
      {
        phase,
        checks: metrics.length,
        overflow: metrics.filter((m) => m.overflow),
        errors,
        unexpectedConsoleErrors,
        maxInitialLoadCLS: Math.max(...metrics.map((m) => m.initialLoadCLS)),
      },
      null,
      2,
    ),
  );
  if (
    errors.length ||
    unexpectedConsoleErrors.length ||
    metrics.some(
      (metric) =>
        metric.overflow ||
        metric.status !== (metric.route === '/unknown-ui-audit' ? 404 : 200),
    )
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
