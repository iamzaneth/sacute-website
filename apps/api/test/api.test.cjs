const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
process.env.NODE_ENV = 'test';
const { createApplication } = require('../dist/application');
const { validateEnvironment } = require('../dist/config/environment');
const { listContent, localContent } = require('@sacute/shared');
let app;
let baseUrl;
before(async () => {
  app = await createApplication();
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});
after(async () => {
  await app?.close();
});

test('health endpoint works without a database', async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'ok');
});
for (const kind of ['information', 'scholarships', 'events']) {
  test(`${kind} returns an empty page for an unmatched search`, async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/${kind}?page=2&limit=5&q=test`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: [],
      meta: {
        total: 0,
        page: 2,
        limit: 5,
        source: 'local',
        contentStatus: 'pending-verification',
      },
    });
  });
}
for (const kind of ['information', 'scholarships', 'events']) {
  test(`${kind} serves the current collection and local attachments`, async () => {
    const { data, meta } = await (
      await fetch(`${baseUrl}/api/v1/${kind}?limit=100`)
    ).json();
    assert.equal(meta.total, localContent[kind].length);
    assert.deepEqual(data, localContent[kind].slice(0, 100));
    for (const item of data) {
      for (const image of item.images ?? []) {
        const response = await fetch(`${baseUrl}${image.url}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /^image\//);
        assert.deepEqual(
          Buffer.from(await response.arrayBuffer()),
          readFileSync(
            path.resolve(__dirname, '../public', image.url.slice(1)),
          ),
        );
      }
    }
    for (const category of new Set(
      localContent[kind].map((item) => item.category),
    )) {
      const result = await (
        await fetch(
          `${baseUrl}/api/v1/${kind}?limit=100&category=${encodeURIComponent(category)}`,
        )
      ).json();
      const expected = localContent[kind].filter(
        (item) => item.category === category,
      );
      assert.equal(result.meta.total, expected.length);
      assert.deepEqual(result.data, expected.slice(0, 100));
    }
  });
}
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
    const response = await fetch(`${baseUrl}/api/v1/information?${query}`);
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).error.statusCode, 400);
  }
});
test('CORS permits configured origins and omits permission for others', async () => {
  const allowed = await fetch(`${baseUrl}/api/v1/events`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert.equal(
    allowed.headers.get('access-control-allow-origin'),
    'http://localhost:5173',
  );
  const blocked = await fetch(`${baseUrl}/api/v1/events`, {
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
});
test('unknown endpoints return a consistent 404 error', async () => {
  const response = await fetch(`${baseUrl}/api/v1/missing`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.statusCode, 404);
});
test('configuration rejects unsafe origins and invalid ports', () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: 'production' }),
    /CORS_ORIGINS/,
  );
  assert.throws(() => validateEnvironment({ PORT: 0 }), /PORT/);
  assert.throws(() => validateEnvironment({ CORS_ORIGINS: '*' }));
  assert.throws(() =>
    validateEnvironment({ CORS_ORIGINS: 'https://example.test/path' }),
  );
});
test('repository filtering and pagination preserve Vietnamese content', () => {
  const items = [
    {
      id: '1',
      slug: 'one',
      title: 'Hỗ trợ học tập',
      summary: 'Nội dung thử nghiệm',
      category: 'Hỗ trợ',
    },
    {
      id: '2',
      slug: 'two',
      title: 'Thông báo mới',
      summary: 'Hỗ trợ sinh viên',
      category: 'Thông báo',
    },
  ];
  const result = listContent(items, {
    q: 'HỖ TRỢ',
    category: 'Hỗ trợ',
    page: 1,
    limit: 1,
  });
  assert.equal(result.meta.total, 1);
  assert.equal(result.data[0].id, '1');
  assert.equal(listContent(items, { page: 2, limit: 1 }).data[0].id, '2');
});
