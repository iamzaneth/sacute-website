const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
const { createApplication } = require('../dist/application');
const { validateEnvironment } = require('../dist/config/environment');
const { listContent } = require('@sacute/shared');
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
  test(`${kind} returns the documented empty paginated contract`, async () => {
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
