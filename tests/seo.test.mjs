import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  buildSeoFiles,
  validateOrigin,
} from '../apps/web/scripts/generate-seo.mjs';

const routes = [
  '/',
  '/information',
  '/scholarships',
  '/events',
  '/contact',
  '/recruitment',
];
test('SEO defaults keep previews and pending pages out of search engines', () => {
  assert.match(buildSeoFiles({}).robots, /Disallow: \//);
  assert.doesNotMatch(buildSeoFiles({}).sitemap, /<loc>/);
  const configured = buildSeoFiles({
    VITE_SITE_ORIGIN: 'https://verified.example',
    VITE_ALLOW_INDEXING: 'true',
  });
  assert.doesNotMatch(configured.sitemap, /<loc>/);
  assert.match(configured.robots, /Disallow: \//);
});
test('production origins cannot contain paths, credentials or local hosts', () => {
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
test('all six build outputs contain meaningful Vietnamese HTML and unique metadata', async () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const route of routes) {
    const html = await readFile(
      `apps/web/build/client${route === '/' ? '' : route}/index.html`,
      'utf8',
    );
    assert.match(html, /<html lang="vi"/);
    assert.match(html, /<h1[^>]*>.+?<\/h1>/s, route);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(
      html,
      /rel="canonical"/,
      'Default builds must not invent a domain',
    );
    titles.add(html.match(/<title>(.*?)<\/title>/s)?.[1]);
    descriptions.add(html.match(/name="description" content="(.*?)"/)?.[1]);
  }
  assert.equal(titles.size, 6);
  assert.equal(descriptions.size, 6);
});
test('SEO files and 404 fallback exist in the static output', async () => {
  assert.match(
    await readFile('apps/web/build/client/robots.txt', 'utf8'),
    /Disallow: \//,
  );
  assert.match(
    await readFile('apps/web/build/client/sitemap.xml', 'utf8'),
    /<urlset/,
  );
  assert.match(
    await readFile('apps/web/build/client/404.html', 'utf8'),
    /<html lang="vi"/,
  );
});

test('prerendered team descriptions preserve every supplied bullet, including closed accordions', async () => {
  const html = await readFile(
    'apps/web/build/client/recruitment/index.html',
    'utf8',
  );
  const expected = JSON.parse(
    await readFile('tests/fixtures/recruitment-content-hashes.json', 'utf8'),
  );
  assert.match(html, /<title>Tuyển thành viên \| SACUTE<\/title>/);
  const decode = (value) =>
    value
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  let count = 0;
  for (const [slug, evidence] of Object.entries(expected)) {
    const match = html.match(
      new RegExp(
        `<details\\b(?=[^>]*\\bid="${slug}")[^>]*>([\\s\\S]*?)<\\/details>`,
      ),
    );
    assert.ok(match, `Missing prerendered team: ${slug}`);
    const lists = [...match[1].matchAll(/<ul>([\s\S]*?)<\/ul>/g)];
    assert.deepEqual(
      lists.map(([, list]) => [...list.matchAll(/<li>/g)].length),
      evidence.counts,
      slug,
    );
    const bullets = lists.flatMap(([, list]) =>
      [...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(([, text]) =>
        decode(text),
      ),
    );
    assert.equal(
      createHash('sha256').update(bullets.join('\n')).digest('hex'),
      evidence.sha256,
      `Content changed for ${slug}`,
    );
    count += bullets.length;
    for (const heading of [
      'Mô tả công việc',
      'Yêu cầu công việc',
      'Quyền lợi tham gia',
    ])
      assert.ok(match[1].includes(heading));
  }
  assert.equal(count, 72);
  assert.match(html, /Nội dung này đang chờ xác nhận biên tập/);
});

test('official logo is deployed without changing its original bytes', async () => {
  const source = await readFile('apps/web/public/branding/logo-sacute.svg');
  const deployed = await readFile(
    'apps/web/build/client/branding/logo-sacute.svg',
  );
  assert.deepEqual(deployed, source);
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    'a9f35df31e2431088406b353ffbdc36180ff1e598656db6478df3761e9a63bd2',
  );
});

test('supplied contact details are present in prerendered contact and footer content', async () => {
  const html = await readFile(
    'apps/web/build/client/contact/index.html',
    'utf8',
  );
  for (const value of [
    'sacute@hcmute.edu.vn',
    'Số 01, Võ Văn Ngân, P. Thủ Đức, TP. HCM',
    'https://www.facebook.com/hotrosinhvienspkt',
    'https://www.tiktok.com/@sacute.2015',
  ])
    assert.ok(html.includes(value), value);
  const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(footer);
  assert.doesNotMatch(
    footer,
    /href="\/information"|Tư vấn &amp; hỗ trợ sinh viên/,
  );
  assert.match(footer, /Trung tâm Tư vấn và Hỗ trợ Sinh viên/);
});
