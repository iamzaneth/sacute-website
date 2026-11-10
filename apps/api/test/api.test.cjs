const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { validateEnvironment } = require('../dist/config/environment');
let app, baseUrl, fixture;
before(async () => {
  const { startFixtureDatabase, testKey } =
    await import('../../../tests/support/supabase.mjs');
  fixture = await startFixtureDatabase();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    SUPABASE_URL: fixture.url,
    SUPABASE_PUBLISHABLE_KEY: testKey,
  });
  const { createApplication } = require('../dist/application');
  app = await createApplication();
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});
after(async () => {
  await app?.close();
  await fixture?.close();
});
const get = (path) => fetch(`${baseUrl}/api/v1/${path}`);
test('health and public lists work through the Supabase adapter', async () => {
  assert.equal((await get('health')).status, 200);
  for (const [kind, total] of [
    ['information', 3],
    ['scholarships', 1],
    ['events', 1],
  ]) {
    const response = await get(kind);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.meta.source, 'supabase');
    assert.equal(body.meta.total, total);
    assert.ok(
      !body.data.some((p) => ['draft', 'archived', 'future'].includes(p.id)),
    );
  }
});
test('category, Vietnamese search, pagination and details preserve contracts', async () => {
  const notices = await (
    await get('information?category=Thông%20báo&q=HỖ%20TRỢ&limit=1&page=2')
  ).json();
  assert.equal(notices.meta.total, 2);
  assert.equal(notices.data[0].id, 'older');
  const activities = await (
    await get('information?category=Hoạt%20động')
  ).json();
  assert.equal(activities.data[0].kind, 'event');
  assert.equal(activities.data[0].category, 'Hoạt động');
  const scholarship = await (
    await get('posts/bai-thu-nghiem-scholarship')
  ).json();
  assert.equal(scholarship.data.provider, 'Đơn vị thử nghiệm');
  assert.equal(scholarship.data.status, 'open');
  const event = await (await get('posts/bai-thu-nghiem-event')).json();
  assert.equal(event.data.startsOn, '2026-01-01');
  assert.equal(event.data.publishedAt, '2026-01-01');
  assert.equal(event.data.publishedAtPrecision, 'date');
  assert.ok(
    event.data.images[0].url.includes('/storage/v1/object/public/post-media/'),
  );
});
test('unknown, draft, archived and scheduled slugs return consistent HTTP 404', async () => {
  for (const slug of [
    'missing',
    'bai-thu-nghiem-draft',
    'bai-thu-nghiem-archived',
    'bai-thu-nghiem-future',
  ]) {
    const response = await get(`posts/${slug}`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.statusCode, 404);
  }
  assert.equal((await get('missing')).status, 404);
});
test('database failures are HTTP 503 errors, never empty lists', async () => {
  fixture.state.fail = true;
  try {
    const response = await get('information');
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.statusCode, 503);
  } finally {
    fixture.state.fail = false;
  }
});
test('query validation rejects malformed and unknown parameters', async () => {
  for (const query of [
    'page=0',
    'page=hello',
    'page=1.5',
    'limit=101',
    'limit=-1',
    'unknown=true',
    'q=' + 'a'.repeat(201),
  ]) {
    const response = await get(`information?${query}`);
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).error.statusCode, 400);
  }
});
test('CORS retains the configured allowlist', async () => {
  for (const [origin, expected] of [
    ['http://localhost:5173', 'http://localhost:5173'],
    ['https://untrusted.example', null],
  ]) {
    const response = await fetch(`${baseUrl}/api/v1/events`, {
      headers: { Origin: origin },
    });
    assert.equal(response.headers.get('access-control-allow-origin'), expected);
  }
});
test('configuration validates origins, ports and public Supabase credentials', () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: 'production' }),
    /CORS_ORIGINS/,
  );
  assert.throws(() => validateEnvironment({ PORT: 0 }), /PORT/);
  assert.throws(() => validateEnvironment({ CORS_ORIGINS: '*' }));
  assert.throws(() =>
    validateEnvironment({ CORS_ORIGINS: 'https://example.test/path' }),
  );
  assert.throws(() =>
    validateEnvironment({
      SUPABASE_URL: 'https://example.test',
      SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private',
    }),
  );
});
test('API clock, Trash and conditional private-media delivery share public visibility', async () => {
  const id = '00000000-0000-4000-8000-000000000071';
  const mediaId = '00000000-0000-4000-8000-000000000072';
  const row = {
    ...structuredClone(fixture.state.rows[0]),
    id,
    slug: 'api-scheduled-private',
    visible_from: '2030-11-15T00:00:00Z',
    post_media: [
      {
        id: mediaId,
        bucket: 'draft-media',
        storage_path: 'admin/fixture/private.png',
        sort_order: 0,
        is_cover: true,
        alt_text: 'Private',
        width: 2,
        height: 2,
      },
    ],
  };
  fixture.state.rows.push(row);
  fixture.state.now = '2030-11-14T23:59:59Z';
  const path = `media/posts/${id}/${mediaId}`;
  try {
    assert.equal((await get('posts/' + row.slug)).status, 404);
    assert.equal((await get(path)).status, 404);
    fixture.state.now = row.visible_from;
    const detail = await (await get('posts/' + row.slug)).json();
    assert.equal(detail.data.images[0].url, '/api/v1/' + path);
    const image = await get(path);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('cache-control'), 'no-store');
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.ok((await image.arrayBuffer()).byteLength);
    row.deleted_at = row.visible_from;
    assert.equal((await get('posts/' + row.slug)).status, 404);
    assert.equal((await get(path)).status, 404);
    const list = await (await get('information?q=Thông')).json();
    assert.ok(!list.data.some((p) => p.id === id));
    assert.equal((await get(`media/posts/invalid/${mediaId}`)).status, 404);
  } finally {
    delete fixture.state.now;
    fixture.state.rows.splice(fixture.state.rows.indexOf(row), 1);
  }
});
