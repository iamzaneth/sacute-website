import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { organization, publicRoutes } from '../packages/shared/dist/index.js';
import {
  buildSeoFiles,
  validateOrigin,
} from '../apps/web/scripts/generate-seo.mjs';
import { startFixtureDatabase, testKey, rows } from './support/supabase.mjs';
let fixture, child;
const base = 'http://127.0.0.1:4174';
before(async () => {
  fixture = await startFixtureDatabase();
  child = spawn(process.execPath, ['scripts/preview.mjs'], {
    cwd: 'apps/web',
    env: {
      ...process.env,
      PORT: '4174',
      SUPABASE_URL: fixture.url,
      SUPABASE_PUBLISHABLE_KEY: testKey,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null)
      throw new Error(`SSR preview exited: ${stderr}`);
    try {
      if ((await fetch(`${base}/contact`)).ok) return;
    } catch {
      /* Wait for startup. */
    }
    await delay(100);
  }
  throw new Error(`SSR preview did not start: ${stderr}`);
});
after(async () => {
  if (child?.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  }
  await fixture?.close();
});
test('all public routes return Vietnamese server HTML and unique metadata', async () => {
  const titles = new Set(),
    descriptions = new Set();
  for (const route of publicRoutes) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.match(html, /<html lang="vi"/);
    assert.match(html, /<h1[^>]*>.+?<\/h1>/s);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(html, /rel="canonical"/);
    titles.add(html.match(/<title>(.*?)<\/title>/s)?.[1]);
    descriptions.add(html.match(/name="description" content="(.*?)"/)?.[1]);
  }
  assert.equal(titles.size, publicRoutes.length);
  assert.equal(descriptions.size, publicRoutes.length);
});
test('article SSR contains complete text, metadata, Vietnam timestamp and ordered Storage images', async () => {
  const response = await fetch(`${base}/posts/bai-thu-nghiem-notice`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text();
  assert.match(html, /<title>Thông báo thử nghiệm mới \| SACUTE<\/title>/);
  assert.match(html, /Nội dung thử nghiệm tiếng Việt 🎉/);
  assert.match(html, /08:30/);
  assert.match(html, /03\/01\/2026/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /storage\/v1\/object\/public\/post-media/);
  const gallery = html.slice(html.indexOf('class="post-gallery'));
  assert.ok(
    gallery.indexOf('synthetic/0.png') < gallery.indexOf('synthetic/1.png'),
  );
  const dateOnly = await (
    await fetch(`${base}/posts/bai-thu-nghiem-event`)
  ).text();
  assert.match(dateOnly, /<time dateTime="2026-01-01">01\/01\/2026<\/time>/);
});
test('newly published slug and homepage updates work without rebuilding; archive takes effect immediately', async () => {
  const row = {
    ...structuredClone(rows[0]),
    id: 'new',
    slug: 'bai-moi-khong-can-build',
    title: 'Thông báo vừa công bố',
    published_on: '2026-02-01',
    published_at: '2026-02-01T00:00:00Z',
  };
  fixture.state.rows.push(row);
  assert.equal((await fetch(`${base}/posts/${row.slug}`)).status, 200);
  assert.match(await (await fetch(base)).text(), /Thông báo vừa công bố/);
  row.status = 'archived';
  assert.equal((await fetch(`${base}/posts/${row.slug}`)).status, 404);
  assert.doesNotMatch(
    await (await fetch(base)).text(),
    /Thông báo vừa công bố/,
  );
});
test('private and unknown content produces real 404; errors produce 503 rather than empty states', async () => {
  for (const slug of [
    'missing',
    'bai-thu-nghiem-draft',
    'bai-thu-nghiem-archived',
    'bai-thu-nghiem-future',
  ]) {
    const response = await fetch(`${base}/posts/${slug}`);
    assert.equal(response.status, 404);
    assert.doesNotMatch(
      await response.text(),
      /Bản nháp riêng tư|Bài hẹn giờ|Bài đã lưu trữ/,
    );
  }
  assert.equal((await fetch(`${base}/unknown-route`)).status, 404);
  assert.equal((await fetch(`${base}/assets/nonexistent.js`)).status, 404);
  fixture.state.fail = true;
  try {
    const response = await fetch(`${base}/information`);
    assert.equal(response.status, 503);
    const html = await response.text();
    assert.match(html, /Không thể tải nội dung/);
    assert.doesNotMatch(html, /Chưa có thông báo/);
  } finally {
    fixture.state.fail = false;
  }
});
test('SEO defaults protect previews and origin validation rejects unsafe inputs', () => {
  assert.match(buildSeoFiles({}).robots, /Disallow: \//);
  assert.doesNotMatch(buildSeoFiles({}).sitemap, /<loc>/);
  for (const origin of [
    'http://example.test',
    'https://localhost',
    'https://example.test/path',
    'https://user:password@example.test',
  ])
    assert.throws(() => validateOrigin(origin));
  assert.equal(
    validateOrigin('https://verified.example/'),
    'https://verified.example',
  );
});
test('browser build has no Supabase SDK, credentials, hardcoded articles or static data payloads', async () => {
  const files = await readdir('apps/web/build/client', { recursive: true });
  assert.ok(
    !files.some((file) => file.endsWith('.data') || file.endsWith('.html')),
  );
  let credentials = [];
  try {
    credentials = (await readFile('apps/api/.env', 'utf8'))
      .split(/\r?\n/)
      .filter((line) => /^(SUPABASE_.*KEY|DATABASE_URL|.*PASSWORD)=/.test(line))
      .map((line) => line.slice(line.indexOf('=') + 1).trim())
      .filter(Boolean);
  } catch {
    /* CI has no local env file. */
  }
  for (const file of files.filter((f) => f.endsWith('.js'))) {
    const code = await readFile(`apps/web/build/client/${file}`, 'utf8');
    assert.doesNotMatch(
      code,
      /sb_secret_|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|\/media\/mock\/|localContent|SupabaseClient/,
    );
    for (const credential of credentials)
      assert.ok(
        !code.includes(credential),
        'Browser bundle contains a credential',
      );
    for (const slug of [
      'bi-kip-giao-tiep-da-chieu-2026',
      'hoc-bong-sinh-vien-2026-2027',
    ])
      assert.ok(!code.includes(slug));
  }
});
test('contact and footer retain supplied brand details', async () => {
  const html = await (await fetch(`${base}/contact`)).text();
  for (const value of [
    organization.email,
    organization.address,
    ...organization.socialLinks.map((s) => s.url),
  ])
    assert.ok(html.includes(value));
  const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(footer);
  assert.doesNotMatch(footer, /href="\/information"/);
});
