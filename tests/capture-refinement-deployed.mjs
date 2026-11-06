import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = 'docs/ui-ux/screenshots/refinement-deployed';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const metrics = [];
try {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/information',
      '/scholarships',
      '/events',
      '/contact',
      '/recruitment',
    ]) {
      const response = await page.goto(`https://sacute.vercel.app${route}`, {
        timeout: 30000,
      });
      await page.locator('h1').first().waitFor();
      metrics.push({
        width,
        route,
        status: response.status(),
        title: await page.title(),
        ...(await page.evaluate(() => ({
          heading: document.querySelector('h1')?.textContent,
          sidebar: document.querySelector('.sidebar')
            ? getComputedStyle(document.querySelector('.sidebar'))
                .backgroundColor
            : null,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }))),
      });
      if (
        route === '/' ||
        (['/contact', '/recruitment'].includes(route) && width !== 768)
      )
        await page.screenshot({
          path: `${directory}/${route === '/' ? 'home' : route.slice(1)}-${width}.png`,
          fullPage: true,
        });
    }
  }
  await writeFile(
    'docs/ui-ux/refinement-deployed-metrics.json',
    JSON.stringify(metrics, null, 2) + '\n',
  );
  console.log(JSON.stringify(metrics, null, 2));
} finally {
  await browser.close();
}
