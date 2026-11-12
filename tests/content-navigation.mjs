import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

// Run after pnpm build. Pass an installed Playwright module path as argument.
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
let published = true;
let title = 'Bài viết kiểm tra cache';
let databaseDelay = 0;
const fixture = createServer(async (request, response) => {
  if (request.url.includes('/rpc/sacute_content_time')) {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(new Date().toISOString()));
    return;
  }
  if (request.url.startsWith('/storage/')) {
    response.setHeader('Content-Type', 'image/svg+xml');
    response.end(
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="orange"/></svg>',
    );
    return;
  }
  if (request.url.startsWith('/rest/v1/posts')) {
    await delay(databaseDelay);
    const rows = published
      ? [
          {
            id: '00000000-0000-4000-8000-000000000001',
            slug: 'cache-test',
            kind: 'information',
            title,
            summary: 'Nội dung thử nghiệm.',
            content:
              'Đây là nội dung dài để kiểm tra trạng thái mở rộng bài viết. '.repeat(
                30,
              ),
            content_format: 'plain-text',
            category: 'Thông báo',
            status: 'published',
            visible_from: null,
            deleted_at: null,
            published_on: '2026-11-01',
            published_at: null,
            published_at_precision: 'date',
            post_media: [
              {
                id: 'image-1',
                bucket: 'post-media',
                storage_path: 'test.svg',
                alt_text: 'Ảnh kiểm tra',
                width: 600,
                height: 400,
                sort_order: 0,
                is_cover: true,
              },
            ],
            event_details: null,
            scholarship_details: null,
          },
        ]
      : [];
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Content-Range', rows.length ? '0-0/1' : '*/0');
    response.end(JSON.stringify(rows));
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
const port = 5195;
const origin = `http://127.0.0.1:${port}`;
let serverOutput = '';
const server = spawn(process.execPath, ['scripts/preview.mjs'], {
  cwd: 'apps/web',
  env: {
    ...process.env,
    PORT: String(port),
    SUPABASE_URL: `http://127.0.0.1:${fixture.address().port}`,
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_navigation_test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (chunk) => {
  serverOutput += chunk;
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk;
});
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`${origin}/contact`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for local preview startup. */
    }
    await delay(100);
  }
  assert.ok(ready, serverOutput);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const reads = [];
  page.on('request', (request) => {
    if (request.url().includes('/resources/content?'))
      reads.push(request.url());
  });
  await page.goto(`${origin}/information`);
  await page.locator('.post-card-link').waitFor();
  await page.waitForFunction(() => Boolean(window.__reactRouterContext));
  await delay(200);
  await page.locator('.post-card-link').click();
  await page.locator('.post-detail h1').waitFor();
  assert.equal(
    reads.filter((url) => url.includes('view=post')).length,
    0,
    'Fresh full article from list should require no detail fetch',
  );
  await page.getByRole('button', { name: 'Xem thêm', exact: true }).click();
  await page.locator('.post-photo').click();
  await page.locator('dialog[open]').waitFor();
  await page.locator('.post-detail').evaluate((node) => {
    node.dataset.retained = 'yes';
  });

  // Background validation with a changed title must preserve the article tree.
  title = 'Tiêu đề đã cập nhật';
  databaseDelay = 600;
  await page.evaluate(() => {
    const originalNow = Date.now;
    Date.now = () => originalNow() + 61_000;
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForFunction(
    () =>
      document.querySelector('.post-detail h1')?.textContent ===
      'Tiêu đề đã cập nhật',
  );
  assert.equal(
    await page.locator('.post-detail').getAttribute('data-retained'),
    'yes',
  );
  assert.equal(
    await page.locator('.post-text-toggle').getAttribute('aria-expanded'),
    'true',
  );
  assert.equal(await page.locator('dialog[open]').count(), 1);
  assert.equal(reads.filter((url) => url.includes('view=post')).length, 1);
  await page.getByRole('button', { name: 'Đóng ảnh', exact: true }).click();

  // A 304 also preserves expansion; a later 404 removes the visible article.
  await page.evaluate(() => {
    const previousNow = Date.now;
    Date.now = () => previousNow() + 61_000;
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForResponse(
    (response) =>
      response.url().includes('view=post') && response.status() === 304,
  );
  assert.equal(
    await page.locator('.post-text-toggle').getAttribute('aria-expanded'),
    'true',
  );
  published = false;
  await delay(100);
  await page.evaluate(() => {
    const previousNow = Date.now;
    Date.now = () => previousNow() + 61_000;
    window.dispatchEvent(new Event('focus'));
  });
  await page
    .getByRole('alert')
    .filter({ hasText: 'Không tìm thấy bài viết' })
    .first()
    .waitFor();
  assert.equal(await page.locator('.post-detail').count(), 0);

  // Direct SSR detail is cached during hydration, without refetch on return.
  published = true;
  databaseDelay = 0;
  const direct = await browser.newPage();
  const directReads = [];
  direct.on('pageerror', (error) => errors.push(error.message));
  direct.on('request', (request) => {
    if (request.url().includes('view=post')) directReads.push(request.url());
  });
  await direct.goto(`${origin}/posts/cache-test`);
  await direct.locator('.post-detail h1').waitFor();
  await delay(200);
  await direct.locator('.post-back-link').click();
  await direct.locator('.post-card-link').waitFor();
  await direct.addStyleTag({
    content: '.article-list { min-height: 2400px; }',
  });
  await direct.evaluate(() => window.scrollTo(0, 450));
  await direct.waitForFunction(() => window.scrollY === 450);
  await direct.locator('.post-card-link').evaluate((node) => node.click());
  await direct.locator('.post-detail h1').waitFor();
  assert.equal(directReads.length, 0);
  await direct.locator('.post-back-link').click();
  await direct.locator('.post-card-link').waitFor();
  await direct.waitForFunction(() => window.scrollY === 450);

  // Cold navigation prefetch and click share the same data request.
  const cold = await browser.newPage({ viewport: { width: 390, height: 844 } });
  cold.on('pageerror', (error) => errors.push(error.message));
  let coldReads = 0;
  cold.on('request', (request) => {
    if (request.url().includes('view=information')) coldReads++;
  });
  await cold.goto(`${origin}/contact`);
  await cold.getByRole('button', { name: /mở.*menu|mở.*điều hướng/i }).click();
  const informationLink = cold.locator('dialog a[href="/information"]');
  await informationLink.focus();
  await informationLink.click();
  await cold.locator('.post-card-link').waitFor();
  assert.equal(coldReads, 1);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: fresh list → detail without fetch; background 200/304 preserves expansion and gallery; 404 removes article; SSR detail cache; return link restores scroll; mobile prefetch deduplication; no browser errors.',
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => fixture.close(resolve));
}
