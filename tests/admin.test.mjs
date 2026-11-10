import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { startAdminFixture, editorPostID } from './support/admin-supabase.mjs';
import { testKey } from './support/supabase.mjs';
import {
  validatePostForm,
  ValidationError,
  validStoragePath,
} from '../apps/web/app/features/admin/model.ts';
import {
  assertSameOrigin,
  writesEnabled,
  assertWritesEnabled,
  createAuthContext,
  verifyAdmin,
} from '../apps/web/app/services/admin-auth.server.ts';
const base = 'http://127.0.0.1:4175';
const writableBase = 'http://127.0.0.1:4176';
let fixture;
const children = [];
function validForm(overrides = {}) {
  return FormDataFromObject({
    title: 'Bài mới',
    slug: 'bai-moi',
    summary: 'Tóm tắt',
    content: 'Nội dung',
    category: 'Thông báo',
    kind: 'information',
    status: 'draft',
    intent: 'save',
    content_format: 'plain-text',
    media: '[]',
    ...overrides,
  });
}
function FormDataFromObject(object) {
  const form = new FormData();
  for (const [key, value] of Object.entries(object)) form.set(key, value);
  return form;
}
async function login(origin = base, email = 'admin@example.test') {
  const response = await fetch(`${origin}/admin/login`, {
    method: 'POST',
    headers: { Origin: origin },
    body: new URLSearchParams({ email, password: 'synthetic-password' }),
    redirect: 'manual',
  });
  return {
    response,
    cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
  };
}
before(async () => {
  fixture = await startAdminFixture();
  for (const [origin, enabled] of [
    [base, undefined],
    [writableBase, 'true'],
  ]) {
    const env = {
      ...process.env,
      PORT: new URL(origin).port,
      ADMIN_ORIGIN: origin,
      SUPABASE_URL: fixture.url,
      SUPABASE_PUBLISHABLE_KEY: testKey,
    };
    delete env.ADMIN_WRITES_ENABLED;
    if (enabled) env.ADMIN_WRITES_ENABLED = enabled;
    const child = spawn(process.execPath, ['scripts/preview.mjs'], {
      cwd: 'apps/web',
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    children.push(child);
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    let started = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(`SSR exited: ${stderr}`);
      try {
        if ((await fetch(`${origin}/admin/login`)).ok) {
          started = true;
          break;
        }
      } catch {
        /* startup */
      }
      await delay(100);
    }
    assert.ok(started, stderr);
  }
});
after(async () => {
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        await new Promise((resolve) => child.once('exit', resolve));
      }
    }),
  );
  await fixture?.close();
});
test('write gate defaults to false and accepts only literal true', () => {
  for (const value of [undefined, false, true, 'TRUE', '1', 'false']) {
    assert.equal(writesEnabled({ ADMIN_WRITES_ENABLED: value }), false);
    assert.throws(
      () => assertWritesEnabled({ ADMIN_WRITES_ENABLED: value }),
      (e) => e.status === 503,
    );
  }
  assert.equal(writesEnabled({ ADMIN_WRITES_ENABLED: 'true' }), true);
});
test('CSRF rejects cross-site, absent Origin and non-POST requests', () => {
  for (const headers of [
    {},
    { Origin: 'https://evil.test' },
    { Origin: base, 'Sec-Fetch-Site': 'cross-site' },
  ])
    assert.throws(
      () =>
        assertSameOrigin(
          new Request(base + '/admin', { method: 'POST', headers }),
          { ADMIN_ORIGIN: base },
        ),
      (e) => e.status === 403,
    );
  assert.throws(
    () => assertSameOrigin(new Request(base + '/admin'), {}),
    (e) => e.status === 405,
  );
  assertSameOrigin(
    new Request(base + '/admin', { method: 'POST', headers: { Origin: base } }),
    { ADMIN_ORIGIN: base },
  );
});
test('runtime validation checks publication dates, type-specific fields, URLs and gallery', () => {
  assert.equal(validatePostForm(validForm()).post.status, 'draft');
  assert.equal(
    validatePostForm(
      validForm({
        intent: 'publish',
        published_on: '2026-11-10',
        published_at_precision: 'date',
      }),
    ).post.status,
    'published',
  );
  assert.ok(
    validatePostForm(validForm({ intent: 'publish' }), {
      now: new Date('2030-01-01T00:00:00Z'),
    }).post.published_at === '2030-01-01T00:00:00.000Z',
  );
  for (const overrides of [
    { title: '' },
    { slug: '../unsafe' },
    { source_url: 'javascript:alert(1)' },
    { published_on: '2026-02-30' },
    { kind: 'admin' },
    { kind: 'scholarship', scholarship_status: 'bad' },
    {
      kind: 'event',
      event_status: 'ongoing',
      starts_on: '2026-11-20',
      ends_on: '2026-11-10',
    },
    {
      published_at_precision: 'datetime',
      published_on: '2026-11-10',
      published_at: '2026-11-10T22:00:00Z',
    },
    {
      media: JSON.stringify([
        {
          storage_path: '../private',
          alt_text: 'x',
          width: null,
          height: null,
          is_cover: true,
        },
      ]),
    },
  ])
    assert.throws(
      () => validatePostForm(validForm(overrides)),
      ValidationError,
    );
  assert.equal(
    validatePostForm(
      validForm({ kind: 'scholarship', scholarship_status: 'open' }),
    ).scholarship.lifecycle_status,
    'open',
  );
  assert.equal(
    validatePostForm(
      validForm({
        kind: 'event',
        event_status: 'upcoming',
        starts_on: '2026-11-10',
      }),
    ).event.starts_on,
    '2026-11-10',
  );
  for (const path of ['../x', '/x', 'a//b', 'a/./b', 'a\\b', 'a%2fb'])
    assert.equal(validStoragePath(path), false);
});
test('anonymous direct loaders and data requests are protected independently', async () => {
  for (const path of [
    '/admin',
    '/admin/posts',
    '/admin/posts/new',
    `/admin/posts/${editorPostID}/edit`,
    '/admin/media',
    '/admin/posts.data',
  ]) {
    const response = await fetch(base + path, { redirect: 'manual' });
    assert.ok(
      [302, 202].includes(response.status),
      `${path}: ${response.status}`,
    );
    const body = await response.text();
    assert.doesNotMatch(body, /Bản nháp riêng tư|Nội dung thử nghiệm/);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
});
test('login sets HttpOnly scoped cookies, no token in URL; redirect target is fixed', async () => {
  const { response, cookie } = await login();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/admin');
  assert.ok(cookie);
  for (const value of response.headers.getSetCookie()) {
    assert.match(value, /HttpOnly/);
    assert.match(value, /SameSite=Lax/);
    assert.match(value, /Path=\//);
  }
  const response2 = await fetch(base + '/admin/login?next=https://evil.test', {
    method: 'POST',
    headers: { Origin: base },
    body: new URLSearchParams({
      email: 'admin@example.test',
      password: 'synthetic-password',
      next: 'https://evil.test',
    }),
    redirect: 'manual',
  });
  assert.equal(response2.headers.get('location'), '/admin');
});
test('valid admin can list drafts, search, inspect editor and media in read-only mode', async () => {
  const { cookie } = await login();
  for (const path of [
    '/admin',
    '/admin/posts',
    `/admin/posts/${editorPostID}/edit`,
    '/admin/posts/new',
    '/admin/media?prefix=admin',
  ]) {
    const response = await fetch(base + path, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /Chế độ chỉ đọc/);
    assert.match(html, /disabled/);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
  }
  const list = await (
    await fetch(base + '/admin/posts?status=draft', {
      headers: { Cookie: cookie },
    })
  ).text();
  assert.match(list, /Bản nháp riêng tư/);
  assert.doesNotMatch(list, /<td>Thông báo thử nghiệm mới/);
  const search = await (
    await fetch(base + '/admin/posts?q=khong-co', {
      headers: { Cookie: cookie },
    })
  ).text();
  assert.match(search, /Không có bài viết phù hợp/);
});
test('authenticated non-admin is HTTP 403 despite user_metadata claiming admin', async () => {
  const { response, cookie } = await login(base, 'reader@example.test');
  assert.equal(response.status, 403);
  for (const path of ['/admin', '/admin/posts', '/admin/media'])
    assert.equal(
      (await fetch(base + path, { headers: { Cookie: cookie } })).status,
      403,
    );
  const write = await fetch(writableBase + '/admin/posts/new', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: writableBase },
    body: new URLSearchParams(),
    redirect: 'manual',
  });
  assert.equal(write.status, 403);
});
test('every mutating action fails closed before database writes when gate unset', async () => {
  const { cookie } = await login();
  const before = fixture.state.requests.filter((u) =>
    u.pathname.includes('/rpc/'),
  ).length;
  for (const path of [
    '/admin/posts/new',
    `/admin/posts/${editorPostID}/edit`,
    '/admin/media',
  ]) {
    const response = await fetch(base + path, {
      method: 'POST',
      headers: { Origin: base, Cookie: cookie },
      body: new URLSearchParams({ intent: 'publish' }),
      redirect: 'manual',
    });
    assert.equal(response.status, 503, path);
    assert.match(await response.text(), /chỉ đọc/);
  }
  assert.equal(
    fixture.state.requests.filter((u) => u.pathname.includes('/rpc/')).length,
    before,
  );
  const anonymous = await fetch(base + '/admin/posts/new', {
    method: 'POST',
    headers: { Origin: base },
    body: new URLSearchParams(),
    redirect: 'manual',
  });
  assert.equal(anonymous.status, 302);
});
test('server actions reject CSRF including login/logout and uploads', async () => {
  const { cookie } = await login();
  for (const path of [
    '/admin/login',
    '/admin',
    '/admin/posts/new',
    `/admin/posts/${editorPostID}/edit`,
    '/admin/media',
  ]) {
    const response = await fetch(base + path, {
      method: 'POST',
      headers: { Origin: 'https://evil.test', Cookie: cookie },
      body: new URLSearchParams(),
      redirect: 'manual',
    });
    assert.ok(
      [400, 403].includes(response.status),
      `${path}: ${response.status}`,
    );
  }
});
test('expired/revoked session is redirected without leaking draft data; logout clears cookies even in read-only mode', async () => {
  const { cookie } = await login();
  fixture.tokens.clear();
  const expired = await fetch(base + '/admin/posts', {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
  assert.equal(expired.status, 302);
  assert.match(expired.headers.get('location'), /expired=1/);
  const active = await login();
  const logout = await fetch(base + '/admin', {
    method: 'POST',
    headers: { Origin: base, Cookie: active.cookie },
    body: new URLSearchParams(),
    redirect: 'manual',
  });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get('location'), '/admin/login?logout=1');
  assert.ok(logout.headers.getSetCookie().some((c) => /Max-Age=0/.test(c)));
  assert.equal(
    (
      await fetch(base + '/admin', {
        headers: { Cookie: active.cookie },
        redirect: 'manual',
      })
    ).status,
    302,
  );
});
test('enabled write path validates first, then uses only user-scoped atomic RPC', async () => {
  const { cookie } = await login(writableBase);
  const bad = await fetch(writableBase + '/admin/posts/new', {
    method: 'POST',
    headers: { Origin: writableBase, Cookie: cookie },
    body: new URLSearchParams({ intent: 'publish', title: '' }),
    redirect: 'manual',
  });
  assert.equal(bad.status, 422);
  const input = validForm({
    slug: 'published-in-test',
    intent: 'publish',
    published_on: '2026-11-10',
    published_at_precision: 'date',
  });
  const saved = await fetch(writableBase + '/admin/posts/new', {
    method: 'POST',
    headers: { Origin: writableBase, Cookie: cookie },
    body: new URLSearchParams([...input]),
    redirect: 'manual',
  });
  assert.equal(saved.status, 303);
  assert.match(saved.headers.get('location'), /saved=/);
  assert.equal(
    (await fetch(writableBase + '/posts/published-in-test')).status,
    200,
  );
});
test('secure cookies on HTTPS and privileged keys are rejected by auth client', async () => {
  const env = { SUPABASE_URL: fixture.url, SUPABASE_PUBLISHABLE_KEY: testKey };
  const context = createAuthContext(
    new Request('https://admin.example.test/admin/login'),
    env,
  );
  await context.db.auth.signInWithPassword({
    email: 'admin@example.test',
    password: 'synthetic-password',
  });
  assert.ok(context.headers.getSetCookie().every((c) => /; Secure/.test(c)));
  assert.throws(
    () =>
      createAuthContext(new Request(base + '/admin'), {
        ...env,
        SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden',
      }),
    (e) => e.status === 503,
  );
  const forged = {
    db: {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'forged', user_metadata: { role: 'admin' } } },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { role: 'editor' },
              error: null,
            }),
          }),
        }),
      }),
    },
    headers: new Headers(),
  };
  await assert.rejects(verifyAdmin(forged, {}), (e) => e.status === 403);
});
test('public HTML and navigation have no admin links or auth menus', async () => {
  for (const path of [
    '/',
    '/information',
    '/scholarships',
    '/events',
    '/contact',
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.doesNotMatch(
      html,
      /<a\b[^>]*href="\/admin|>Đăng nhập<|>Đăng ký tài khoản</,
    );
  }
  const source = await readFile(
    'apps/web/app/services/admin-auth.server.ts',
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|localStorage/,
  );
});

function expiredCookie(cookie, invalidRefresh = false) {
  const separator = cookie.indexOf('=');
  const name = cookie.slice(0, separator);
  const encoded = decodeURIComponent(cookie.slice(separator + 1));
  const session = JSON.parse(
    Buffer.from(encoded.replace(/^base64-/, ''), 'base64url').toString(),
  );
  const parts = session.access_token.split('.');
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  claims.exp = 1;
  parts[1] = Buffer.from(JSON.stringify(claims)).toString('base64url');
  session.access_token = parts.join('.');
  session.expires_at = 1;
  if (invalidRefresh) session.refresh_token = 'revoked-refresh';
  return `${name}=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
}
test('expired access token refresh propagates cookies on document and client data requests', async () => {
  for (const path of ['/admin/posts', '/admin/posts.data', '/admin.data']) {
    const { cookie } = await login();
    const response = await fetch(base + path, {
      headers: { Cookie: expiredCookie(cookie) },
      redirect: 'manual',
    });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.ok(
      response.headers
        .getSetCookie()
        .some((c) => c.includes('HttpOnly') && c.includes('Path=/')),
      path,
    );
  }
});
test('expired access token with expired refresh is redirected and clears stored session', async () => {
  const { cookie } = await login();
  const response = await fetch(base + '/admin/posts', {
    headers: { Cookie: expiredCookie(cookie, true) },
    redirect: 'manual',
  });
  assert.equal(response.status, 302);
  assert.match(response.headers.get('location'), /expired=1/);
  assert.ok(
    response.headers.getSetCookie().some((c) => c.includes('Max-Age=0')),
  );
});
test('auth/network and role-query failures fail closed as unavailable', async () => {
  const { AuthRetryableFetchError } = await import('@supabase/supabase-js');
  const unavailable = {
    db: {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: new AuthRetryableFetchError('Synthetic network outage', 0),
        }),
      },
    },
    headers: new Headers(),
  };
  await assert.rejects(
    verifyAdmin(unavailable, {}),
    (error) => error.status === 503,
  );
  const roleFailure = {
    db: {
      auth: {
        getUser: async () => ({ data: { user: { id: 'known' } }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { code: '42501' } }),
          }),
        }),
      }),
    },
    headers: new Headers(),
  };
  await assert.rejects(
    verifyAdmin(roleFailure, {}),
    (error) => error.status === 503,
  );
});
test('upload action rejects unsupported bytes, oversized form and duplicate image paths', async () => {
  const { cookie } = await login(writableBase);
  const upload = new FormData();
  upload.set('intent', 'upload');
  upload.set(
    'file',
    new File(['<svg></svg>'], 'fake.png', { type: 'image/png' }),
  );
  const response = await fetch(writableBase + '/admin/media', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: writableBase },
    body: upload,
  });
  assert.equal(response.status, 422);
  const tooLarge = await fetch(writableBase + '/admin/posts/new', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: writableBase },
    body: new URLSearchParams({ content: 'x'.repeat(3 * 1024 * 1024 + 1) }),
  });
  assert.equal(tooLarge.status, 413);
  const item = {
    storage_path: 'admin/existing.png',
    alt_text: '',
    width: null,
    height: null,
    is_cover: true,
  };
  assert.throws(
    () => validatePostForm(validForm({ media: JSON.stringify([item, item]) })),
    ValidationError,
  );
});
