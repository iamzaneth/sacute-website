import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
function moduleURL(source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const resources = moduleURL(
  await readFile('apps/web/app/features/content/public-data.ts', 'utf8'),
);
const images = moduleURL(
  'export const warmed = new Set(); export function warmPublicImage(image) { if(image) warmed.add(image.thumbnailUrl ?? image.url); } export function clearPublicImages() { warmed.clear(); }',
);
const { warmed } = await import(images);
const cache = await import(
  moduleURL(
    (await readFile('apps/web/app/services/public-content-cache.ts', 'utf8'))
      .replaceAll(
        "'../features/content/public-data'",
        JSON.stringify(resources),
      )
      .replaceAll("'./public-image-cache'", JSON.stringify(images)),
  )
);
const { publicResource } = await import(resources);
const originalWindow = globalThis.window,
  originalFetch = globalThis.fetch;
const origin = 'https://sacute.test';
const item = (index) => ({
  id: String(index),
  slug: `post-${index}`,
  coverImage: {
    url: `${origin}/public-${index}.jpg`,
    width: 1200,
    height: 800,
  },
});
beforeEach(() => {
  globalThis.window = { location: { origin } };
  cache.clearPublicCache();
});
after(() => {
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
});
test('cold list data starts the first two images before handing content to the route', async () => {
  globalThis.fetch = async () =>
    Response.json(
      { data: [item(1), item(2), item(3)] },
      { headers: { ETag: 'v1' } },
    );
  await cache.fetchPublicContent('information', origin + '/information');
  assert.deepEqual(
    [...warmed],
    [item(1).coverImage.url, item(2).coverImage.url],
  );
});
test('sidebar intent prefetch warms list images even when data is already cached', async () => {
  cache.primePublicCache(
    publicResource('information', origin + '/information'),
    { data: [item(1)] },
    'v1',
  );
  globalThis.fetch = () => {
    throw Error('Unexpected request');
  };
  cache.prefetchPublicContent('information', origin + '/information');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual([...warmed], [item(1).coverImage.url]);
});
test('home prefetch prepares visible blocks within the same two-image budget', async () => {
  globalThis.fetch = async () =>
    Response.json(
      { information: [item(1)], scholarships: [item(2)], events: [item(3)] },
      { headers: { ETag: 'v1' } },
    );
  await cache.fetchPublicContent('home', origin + '/');
  assert.deepEqual(
    [...warmed],
    [item(1).coverImage.url, item(2).coverImage.url],
  );
});
test('detail navigation prepares the first gallery image rather than a different cover', async () => {
  globalThis.fetch = async () =>
    Response.json(
      {
        item: {
          ...item(1),
          images: [{ url: origin + '/gallery.jpg', width: 1200, height: 800 }],
        },
      },
      { headers: { ETag: 'v1' } },
    );
  await cache.fetchPublicContent('post', origin + '/posts/post-1');
  assert.deepEqual([...warmed], [origin + '/gallery.jpg']);
});
test('failed content validation never warms image bytes', async () => {
  globalThis.fetch = async () => new Response(null, { status: 404 });
  await cache.fetchPublicContent('post', origin + '/posts/post-1');
  assert.equal(warmed.size, 0);
});
