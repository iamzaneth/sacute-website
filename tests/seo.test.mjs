import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  localContent,
  organization,
  publicRoutes,
} from '../packages/shared/dist/index.js';
import {
  buildSeoFiles,
  validateOrigin,
} from '../apps/web/scripts/generate-seo.mjs';

const routes = publicRoutes;
test('post detail pages are prerendered with complete content and unique metadata', async () => {
  for (const item of new Map(
    Object.values(localContent)
      .flat()
      .map((post) => [post.slug, post]),
  ).values()) {
    const { slug } = item;
    const html = await readFile(
      `apps/web/build/client/posts/${slug}/index.html`,
      'utf8',
    );
    assert.ok(html.includes(`<title>${item.title} | SACUTE</title>`));
    assert.match(html, /<h1[^>]*>/);
    if (item.publishedAt) assert.ok(html.includes(item.publishedAt));
    if (item.sourceUrl)
      assert.ok(html.includes(item.sourceUrl.replace(/&/g, '&amp;')));
    for (const image of item.images ?? []) assert.ok(html.includes(image.url));
    await readFile(`apps/web/build/client/posts/${slug}.data`);
  }
});
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
test('all public build outputs contain meaningful Vietnamese HTML and unique metadata', async () => {
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
  assert.equal(titles.size, routes.length);
  assert.equal(descriptions.size, routes.length);
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

test('supplied contact details are present in prerendered contact and footer content', async () => {
  const html = await readFile(
    'apps/web/build/client/contact/index.html',
    'utf8',
  );
  for (const value of [
    organization.email,
    organization.address,
    ...organization.socialLinks.map((link) => link.url),
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
