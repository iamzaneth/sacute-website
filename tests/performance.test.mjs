import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { startFixtureDatabase, testKey } from './support/supabase.mjs';
const origin = 'http://127.0.0.1:4220';
let fixture, child, hold, reached;
const resource = (view, rest = '') =>
  `${origin}/resources/content?view=${view}${rest}`;
before(async () => {
  fixture = await startFixtureDatabase(0, async (_req, _res, url) => {
    if (url.pathname === '/rest/v1/posts' && hold) {
      reached?.();
      await hold;
    }
    return false;
  });
  fixture.state.now = '2030-11-10T00:00:00.000Z';
  child = spawn(process.execPath, ['scripts/preview.mjs'], {
    cwd: 'apps/web',
    env: {
      ...process.env,
      PORT: '4220',
      SUPABASE_URL: fixture.url,
      SUPABASE_PUBLISHABLE_KEY: testKey,
      ADMIN_WRITES_ENABLED: 'false',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (c) => (stderr += c));
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(stderr);
    try {
      if ((await fetch(origin + '/contact')).ok) return;
    } catch {
      /* startup */
    }
    await delay(50);
  }
  throw Error(stderr || 'Preview startup timeout');
});
after(async () => {
  if (child?.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((r) => child.once('exit', r));
  }
  await fixture?.close();
});
test('public conditional reads revalidate with the DB before 304 and share one request clock', async () => {
  const clock = fixture.state.clockRequests ?? 0;
  const response = await fetch(resource('home'));
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get('cache-control'),
    /private, no-cache.*must-revalidate/,
  );
  assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
  assert.equal(fixture.state.clockRequests - clock, 1);
  const tag = response.headers.get('etag');
  assert.ok(tag);
  const start = fixture.state.requests.length;
  const unchanged = await fetch(resource('home'), {
    headers: { 'If-None-Match': tag },
  });
  assert.equal(unchanged.status, 304);
  assert.equal(await unchanged.text(), '');
  assert.equal(fixture.state.requests.length - start, 3);
  fixture.state.rows[0].title = 'Fresh changed title';
  try {
    const changed = await fetch(resource('home'), {
      headers: { 'If-None-Match': tag },
    });
    assert.equal(changed.status, 200);
    assert.notEqual(changed.headers.get('etag'), tag);
    assert.equal(
      (await changed.json()).information[0].title,
      'Fresh changed title',
    );
  } finally {
    fixture.state.rows[0].title = 'Thông báo thử nghiệm mới';
  }
});
test('hidden, trashed and newly due posts invalidate conditional lists and details', async () => {
  const row = fixture.state.rows[0],
    original = structuredClone(row);
  const path = resource('post', '&slug=' + row.slug);
  const tag = (await fetch(path)).headers.get('etag');
  try {
    row.status = 'draft';
    assert.equal(
      (await fetch(path, { headers: { 'If-None-Match': tag } })).status,
      404,
    );
    row.status = 'published';
    row.deleted_at = fixture.state.now;
    assert.equal(
      (await fetch(path, { headers: { 'If-None-Match': tag } })).status,
      404,
    );
    row.deleted_at = null;
    row.visible_from = '2030-11-15T00:00:00.000Z';
    const before = await fetch(resource('information'));
    const listTag = before.headers.get('etag');
    assert.ok(!(await before.json()).data.some((p) => p.id === row.id));
    assert.equal((await fetch(path)).status, 404);
    fixture.state.now = row.visible_from;
    const after = await fetch(resource('information'), {
      headers: { 'If-None-Match': listTag },
    });
    assert.equal(after.status, 200);
    assert.ok((await after.json()).data.some((p) => p.id === row.id));
    assert.equal((await fetch(path)).status, 200);
  } finally {
    Object.assign(row, original);
    fixture.state.now = '2030-11-10T00:00:00.000Z';
  }
});
test('errors and malformed views are not cache hits; auth cookies cannot select drafts', async () => {
  const tag = (await fetch(resource('information'))).headers.get('etag');
  fixture.state.fail = true;
  try {
    const response = await fetch(resource('information'), {
      headers: { 'If-None-Match': tag },
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('etag'), null);
  } finally {
    fixture.state.fail = false;
  }
  assert.equal((await fetch(resource('unknown'))).status, 400);
  assert.equal((await fetch(resource('events', '&page=0'))).status, 400);
  const publicOnly = await (
    await fetch(resource('information'), {
      headers: {
        Cookie: 'admin=true',
        Authorization: 'Bearer synthetic-untrusted',
      },
    })
  ).json();
  assert.ok(
    !publicOnly.data.some((p) =>
      ['draft', 'archived', 'future'].includes(p.id),
    ),
  );
  assert.equal(
    (await fetch(resource('post', '&slug=bai-thu-nghiem-draft'))).status,
    404,
  );
});
test('human SSR streams static HTML and skeleton before dynamic reads finish', async () => {
  let release;
  hold = new Promise((resolve) => (release = resolve));
  const hit = new Promise((resolve) => (reached = resolve));
  const controller = new AbortController();
  const request = fetch(origin, {
    signal: controller.signal,
    headers: {
      Accept: 'text/html',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });
  try {
    await hit;
    const response = await Promise.race([
      request,
      delay(3000).then(() => {
        throw Error('Static shell blocked on content');
      }),
    ]);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    while (!html.includes('content-skeleton')) {
      const part = await Promise.race([
        reader.read(),
        delay(3000).then(() => {
          throw Error('Skeleton not streamed');
        }),
      ]);
      if (part.done) break;
      html += decoder.decode(part.value, { stream: true });
    }
    assert.match(html, /SACUTE — Đồng hành cùng sinh viên/);
    assert.match(html, /content-skeleton/);
    assert.doesNotMatch(html, /Thông báo thử nghiệm mới/);
    release();
    hold = undefined;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      html += decoder.decode(part.value, { stream: true });
    }
    assert.match(html, /Thông báo thử nghiệm mới/);
  } finally {
    release();
    hold = undefined;
    reached = undefined;
    controller.abort();
  }
});
test('crawler SSR waits for data and preserves error HTTP status', async () => {
  const headers = { Accept: 'text/html', 'User-Agent': 'Googlebot' };
  const response = await fetch(origin + '/information', { headers });
  const html = await response.text();
  assert.match(html, /<article[^>]+class="article-card/);
  assert.match(html, /Thông báo thử nghiệm mới/);
  assert.doesNotMatch(html, /class="content-skeleton/);
  fixture.state.fail = true;
  try {
    assert.equal(
      (await fetch(origin + '/information', { headers })).status,
      503,
    );
  } finally {
    fixture.state.fail = false;
  }
});
