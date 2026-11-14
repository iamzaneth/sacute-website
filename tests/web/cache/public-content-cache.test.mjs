import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, beforeEach, test } from 'node:test';
import ts from 'typescript';

// Load the browser-only TypeScript module without a DOM or server dependencies.
function moduleURL(source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const resourceURL = moduleURL(
  await readFile('apps/web/app/features/content/data/public-data.ts', 'utf8'),
);
const imageCacheURL = moduleURL(
  await readFile('apps/web/app/services/content/image-cache.ts', 'utf8'),
);
const cache = await import(
  moduleURL(
    (await readFile('apps/web/app/services/content/public-cache.ts', 'utf8'))
      .replaceAll(
        "'~/features/content/data/public-data'",
        JSON.stringify(resourceURL),
      )
      .replaceAll("'./image-cache'", JSON.stringify(imageCacheURL)),
  )
);
const { publicResource } = await import(resourceURL);
const origin = 'https://sacute.test';
const postURL = `${origin}/posts/test-post`;
const listURL = `${origin}/information`;
const postKey = publicResource('post', postURL);
const listKey = publicResource('information', listURL);
const item = {
  id: '1',
  slug: 'test-post',
  content: 'Full text',
  title: 'Test',
};
const list = { data: [item], meta: { total: 1, page: 1, limit: 12 } };
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalNow = Date.now;
let now;

beforeEach(() => {
  globalThis.window = { location: { origin } };
  now = 1_000_000;
  Date.now = () => now;
  cache.clearPublicCache();
  globalThis.fetch = () => {
    throw new Error('Unexpected network request');
  };
});
after(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  Date.now = originalNow;
  delete navigator.connection;
});

test('opening a full article from a fresh list uses no request and inherits its age', async () => {
  cache.primePublicCache(listKey, list, 'list-v1');
  now += 59_000;
  const result = await cache.fetchPublicContent('post', postURL);
  assert.equal(result.ok, true);
  assert.equal(result.value.item, item);
  assert.equal(cache.isPublicCacheFresh(postKey), true);
  now += 1_001;
  assert.equal(cache.isPublicCacheFresh(postKey), false);
});

test('reopening a rendered snapshot does not renew freshness', () => {
  const value = { item };
  cache.primePublicCache(postKey, value, 'v1');
  now += 61_000;
  cache.primePublicCache(postKey, value, 'v1');
  assert.equal(cache.isPublicCacheFresh(postKey), false);
});

test('expired list-derived articles are validated without sending a list ETag', async () => {
  cache.primePublicCache(listKey, list, 'list-v1');
  now += 61_000;
  let requests = 0;
  globalThis.fetch = async (_url, options) => {
    requests++;
    assert.deepEqual(options.headers, {});
    return Response.json({ item }, { headers: { ETag: 'post-v1' } });
  };
  assert.equal((await cache.fetchPublicContent('post', postURL)).ok, true);
  assert.equal(requests, 1);
});

test('prefetch and navigation share one pending request, and 304 renews freshness', async () => {
  cache.primePublicCache(postKey, { item }, 'post-v1');
  now += 61_000;
  let finish;
  let requests = 0;
  globalThis.fetch = (_url, options) => {
    requests++;
    assert.equal(options.headers['If-None-Match'], 'post-v1');
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  cache.prefetchPublicContent('post', postURL);
  const first = cache.fetchPublicContent('post', postURL);
  const second = cache.fetchPublicContent('post', postURL);
  assert.equal(first, second);
  assert.equal(requests, 1);
  finish(new Response(null, { status: 304 }));
  assert.equal((await first).ok, true);
  assert.equal(cache.isPublicCacheFresh(postKey), true);
});

test('404 invalidates both the detail and lists containing the removed article', async () => {
  cache.primePublicCache(listKey, list, 'list-v1');
  now += 61_000;
  globalThis.fetch = async () => new Response(null, { status: 404 });
  const result = await cache.fetchPublicContent('post', postURL);
  assert.equal(result.status, 404);
  assert.equal(cache.peekPublicCache(postKey), undefined);
  assert.equal(cache.peekPublicCache(listKey), undefined);
});

test('clearing cache during a pending read prevents old data returning after admin navigation', async () => {
  let finish;
  globalThis.fetch = () => new Promise((resolve) => (finish = resolve));
  const pending = cache.fetchPublicContent('post', postURL);
  cache.clearPublicCache();
  finish(Response.json({ item }, { headers: { ETag: 'post-v1' } }));
  assert.equal((await pending).status, 409);
  assert.equal(cache.peekPublicCache(postKey), undefined);
});

test('transient errors remove the exact cache entry and do not become offline success', async () => {
  cache.primePublicCache(postKey, { item }, 'post-v1');
  now += 61_000;
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  const result = await cache.fetchPublicContent('post', postURL);
  assert.equal(result.status, 503);
  assert.equal(cache.peekPublicCache(postKey), undefined);
});

test('prefetch respects data saver and slow connections', () => {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: { saveData: true },
  });
  cache.prefetchPublicContent('post', postURL);
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: { effectiveType: '2g' },
  });
  cache.prefetchPublicContent('post', postURL);
  delete navigator.connection;
});

test('expired snapshots cannot seed article detail or refresh their own age', async () => {
  cache.primePublicCache(listKey, list, 'list-v1');
  now += 5 * 60_000 + 1;
  assert.equal(cache.peekPublicCache(postKey), undefined);
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ item }, { headers: { ETag: 'post-v2' } });
  };
  await cache.fetchPublicContent('post', postURL);
  assert.equal(requests, 1);
});

test('malformed encoded slugs produce a stable resource key instead of throwing', () => {
  assert.equal(
    new URL(
      publicResource('post', `${origin}/posts/%ZZ`),
      origin,
    ).searchParams.get('slug'),
    '%ZZ',
  );
});
