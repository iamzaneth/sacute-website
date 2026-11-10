import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  normalizeImage,
  ImageValidationError,
} from '../apps/web/app/services/admin-image.server.ts';
import { createAuthContext } from '../apps/web/app/services/admin-auth.server.ts';
import { startAdminFixture, adminID } from './support/admin-supabase.mjs';
import { imageBytes, testKey } from './support/supabase.mjs';
const origin = 'http://127.0.0.1:4195',
  readonly = 'http://127.0.0.1:4196';
let fixture;
const children = [];
async function login(base = origin, email = 'admin@example.test') {
  const response = await fetch(base + '/admin/login', {
    method: 'POST',
    headers: { Origin: base },
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
async function post(path, form, cookie, base = origin) {
  return fetch(base + path, {
    method: 'POST',
    headers: { Origin: base, Cookie: cookie },
    body: form,
    redirect: 'manual',
  });
}
function uploadForm(bytes = imageBytes, type = 'image/png') {
  const form = new FormData();
  form.set('intent', 'upload');
  form.set('file', new File([bytes], 'image.png', { type }));
  return form;
}
const owned = `admin/${adminID}/00000000-0000-4000-8000-000000000081.png`;
before(async () => {
  fixture = await startAdminFixture();
  for (const base of [origin, readonly]) {
    const child = spawn(process.execPath, ['scripts/preview.mjs'], {
      cwd: 'apps/web',
      env: {
        ...process.env,
        PORT: new URL(base).port,
        ADMIN_ORIGIN: base,
        ADMIN_WRITES_ENABLED: base === origin ? 'true' : 'false',
        SUPABASE_URL: fixture.url,
        SUPABASE_PUBLISHABLE_KEY: testKey,
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    children.push(child);
    let errors = '';
    child.stderr.on('data', (chunk) => (errors += chunk));
    let started = false;
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null) throw Error(errors);
      try {
        if ((await fetch(base + '/admin/login')).ok) {
          started = true;
          break;
        }
      } catch {
        /* starting */
      }
      await delay(50);
    }
    assert.ok(started, errors);
  }
});
after(async () => {
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((r) => child.once('exit', r));
    }
  }
  await fixture?.close();
});
test('actual decoding rejects header-only images, mismatched MIME, huge pixels and oversized files', async () => {
  for (const [bytes, type] of [
    [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'],
    [Buffer.from([255, 216, 255]), 'image/jpeg'],
    [Buffer.from('RIFFxxxxWEBP'), 'image/webp'],
    [imageBytes, 'image/jpeg'],
    [Buffer.from('<svg/>'), 'image/svg+xml'],
    [Buffer.alloc(3 * 1024 * 1024 + 1), 'image/png'],
  ])
    await assert.rejects(
      normalizeImage(new File([bytes], 'unsafe', { type })),
      ImageValidationError,
    );
  const { default: sharp } = await import(
    pathToFileURL(
      createRequire(
        new URL('../apps/web/package.json', import.meta.url),
      ).resolve('sharp'),
    ).href
  );
  const huge = await sharp({
    create: { width: 4100, height: 4100, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    normalizeImage(new File([huge], 'large.png', { type: 'image/png' })),
    ImageValidationError,
  );
  for (const format of ['png', 'jpeg', 'webp']) {
    const bytes = await sharp(imageBytes).toFormat(format).toBuffer();
    const result = await normalizeImage(
      new File(
        [Buffer.concat([bytes, Buffer.from('<script>payload</script>')])],
        'polyglot',
        { type: `image/${format}` },
      ),
    );
    assert.ok(!result.bytes.includes(Buffer.from('<script>payload</script>')));
    assert.equal(result.width, 2);
    assert.equal(result.height, 2);
  }
});
test('remote HTTP Auth upstream is rejected before transmitting credentials', () => {
  assert.throws(
    () =>
      createAuthContext(new Request(origin + '/admin/login'), {
        SUPABASE_URL: 'http://untrusted.example',
        SUPABASE_PUBLISHABLE_KEY: testKey,
      }),
    (error) => error.status === 503,
  );
});
test('real upload/delete intents cannot reach Storage when application gate is false', async () => {
  const { cookie } = await login(readonly);
  const before = fixture.state.storageRequests?.length ?? 0;
  assert.equal(
    (await post('/admin/media', uploadForm(), cookie, readonly)).status,
    503,
  );
  assert.equal(
    (
      await post(
        '/admin/media',
        new URLSearchParams({
          intent: 'delete',
          path: owned,
          confirm: 'delete',
        }),
        cookie,
        readonly,
      )
    ).status,
    503,
  );
  assert.equal(fixture.state.storageRequests?.length ?? 0, before);
});
test('database gate independently disables every SSR mutation even with env true', async () => {
  fixture.state.databaseWrites = false;
  try {
    const { cookie } = await login();
    for (const [path, form] of [
      ['/admin/posts/new', new URLSearchParams({ intent: 'publish' })],
      ['/admin/media', uploadForm()],
      [
        '/admin/media',
        new URLSearchParams({
          intent: 'delete',
          path: owned,
          confirm: 'delete',
        }),
      ],
    ])
      assert.equal((await post(path, form, cookie)).status, 503);
    const response = await fetch(origin + '/admin', {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Chế độ chỉ đọc/);
  } finally {
    fixture.state.databaseWrites = true;
  }
});
test('private preview requires an admin for every request and never emits a public/signed URL', async () => {
  const path =
    '/admin/media/file?' +
    new URLSearchParams({ bucket: 'draft-media', path: owned });
  const anonymous = await fetch(origin + path, { redirect: 'manual' });
  assert.equal(anonymous.status, 302);
  const reader = await login(origin, 'reader@example.test');
  assert.equal(
    (await fetch(origin + path, { headers: { Cookie: reader.cookie } })).status,
    403,
  );
  const { cookie } = await login();
  const image = await fetch(origin + path, { headers: { Cookie: cookie } });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.match(image.headers.get('cache-control'), /private, no-store/);
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  for (const bucket of ['secret', '../../auth'])
    assert.equal(
      (
        await fetch(
          origin +
            '/admin/media/file?' +
            new URLSearchParams({ bucket, path: owned }),
          { headers: { Cookie: cookie } },
        )
      ).status,
      400,
    );
  const malformed = await fetch(
    origin +
      '/admin/media/file?' +
      new URLSearchParams({ bucket: 'draft-media', path: '../secret' }),
    { headers: { Cookie: cookie } },
  );
  assert.equal(malformed.status, 400);
});
test('private images are readable only while an associated post is published and due', async () => {
  const { cookie } = await login();
  const uploaded = await post('/admin/media', uploadForm(), cookie);
  assert.equal(uploaded.status, 200);
  const html = await uploaded.text();
  const match = html.match(
    new RegExp(`Đã tải ảnh: (admin/${adminID}/[a-f0-9-]+\\.png)`),
  );
  assert.ok(match);
  const path = match[1];
  assert.ok(
    fixture.state.storageRequests.some(
      (r) =>
        r.method === 'POST' &&
        r.path === `/storage/v1/object/draft-media/${path}`,
    ),
  );
  assert.ok(
    !fixture.state.storageRequests.some(
      (r) =>
        r.method === 'POST' &&
        r.path.startsWith('/storage/v1/object/post-media/'),
    ),
  );
  const media = [
    {
      bucket: 'draft-media',
      storage_path: path,
      alt_text: 'Private draft',
      width: 2,
      height: 2,
      is_cover: true,
    },
  ];
  const form = new URLSearchParams({
    title: 'Private draft image',
    slug: 'private-image-draft',
    summary: 'Summary',
    content: 'Body',
    category: 'Test',
    kind: 'information',
    content_format: 'plain-text',
    status: 'draft',
    intent: 'draft',
    media: JSON.stringify(media),
  });
  const saved = await post('/admin/posts/new', form, cookie);
  assert.equal(saved.status, 303);
  const editor = await (
    await fetch(origin + saved.headers.get('location'), {
      headers: { Cookie: cookie },
    })
  ).text();
  assert.match(editor, /\/admin\/media\/file\?/);
  assert.doesNotMatch(
    editor,
    /object\/public\/draft-media|object\/sign\/draft-media/,
  );
  assert.equal(
    (await fetch(origin + '/posts/private-image-draft')).status,
    404,
  );
  const row = fixture.state.rows.find((r) => r.slug === 'private-image-draft');
  const imageURL = origin + `/media/posts/${row.id}/${row.post_media[0].id}`;
  const rawURL = fixture.url + `/storage/v1/object/draft-media/${path}`;
  const raw = () =>
    fetch(rawURL, {
      headers: { Authorization: `Bearer ${testKey}`, apikey: testKey },
    });
  const transition = (intent, extra = {}) =>
    post(
      '/admin/posts',
      new URLSearchParams({
        id: row.id,
        revision: row.lifecycle_revision,
        intent,
        confirmed: 'yes',
        ...extra,
      }),
      cookie,
    );
  assert.equal((await fetch(imageURL)).status, 404);
  assert.equal((await raw()).status, 403);
  fixture.state.now = '2030-11-10T00:00:00Z';
  try {
    assert.equal(
      (
        await transition('schedule', {
          schedule_date: '2030-11-15',
          schedule_time: '07:00',
          timezone: 'Asia/Ho_Chi_Minh',
        })
      ).status,
      303,
    );
    assert.equal((await fetch(imageURL)).status, 404);
    assert.equal((await raw()).status, 403);
    fixture.state.now = '2030-11-15T00:00:00Z';
    const image = await fetch(imageURL);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('cache-control'), 'no-store');
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), imageBytes);
    assert.equal((await raw()).status, 200);
    const detail = await (
      await fetch(origin + '/posts/private-image-draft')
    ).text();
    assert.match(
      detail,
      new RegExp(`/media/posts/${row.id}/${row.post_media[0].id}`),
    );
    assert.doesNotMatch(
      detail,
      /object\/public\/draft-media|object\/sign\/draft-media/,
    );
    assert.equal((await transition('hide')).status, 303);
    assert.equal((await fetch(imageURL)).status, 404);
    assert.equal((await raw()).status, 403);
    assert.equal((await transition('publish')).status, 303);
    assert.equal((await fetch(imageURL)).status, 200);
    assert.equal((await transition('trash')).status, 303);
    assert.equal((await fetch(imageURL)).status, 404);
    assert.equal((await raw()).status, 403);
    assert.ok(
      fixture.state.rows.find((r) => r.id === row.id).post_media.length,
    );
  } finally {
    delete fixture.state.now;
  }
  const referenced = await post(
    '/admin/media',
    new URLSearchParams({ intent: 'delete', path, confirm: 'delete' }),
    cookie,
  );
  assert.equal(referenced.status, 422);
  const wrongOwner = await post(
    '/admin/media',
    new URLSearchParams({
      intent: 'delete',
      path: path.replace(adminID, '00000000-0000-4000-8000-000000000002'),
      confirm: 'delete',
    }),
    cookie,
  );
  assert.equal(wrongOwner.status, 422);
});
test('anonymous/non-admin uploads are denied; only unused private files can be deleted', async () => {
  assert.equal((await post('/admin/media', uploadForm(), '')).status, 302);
  const reader = await login(origin, 'reader@example.test');
  assert.equal(
    (await post('/admin/media', uploadForm(), reader.cookie)).status,
    403,
  );
  const { cookie } = await login();
  const uploaded = await post('/admin/media', uploadForm(), cookie);
  const html = await uploaded.text();
  const path = html.match(
    new RegExp(`Đã tải ảnh: (admin/${adminID}/[a-f0-9-]+\\.png)`),
  )[1];
  const deleted = await post(
    '/admin/media',
    new URLSearchParams({ intent: 'delete', path, confirm: 'delete' }),
    cookie,
  );
  assert.equal(deleted.status, 200);
  assert.match(await deleted.text(), /Đã xóa ảnh chưa sử dụng/);
  assert.ok(
    fixture.state.storageRequests.some(
      (r) =>
        r.method === 'DELETE' && r.path === '/storage/v1/object/draft-media',
    ),
  );
  const publicDelete = await post(
    '/admin/media',
    new URLSearchParams({
      intent: 'delete',
      path: 'admin/00000000-0000-4000-8000-000000000081.png',
      bucket: 'post-media',
      confirm: 'delete',
    }),
    cookie,
  );
  assert.equal(publicDelete.status, 422);
});
test('chunked SSR auth cookies survive login and protected loader response', async () => {
  fixture.state.largeMetadata = true;
  try {
    const { response, cookie } = await login();
    assert.equal(response.status, 303);
    assert.ok(response.headers.getSetCookie().length >= 2);
    assert.equal(
      (await fetch(origin + '/admin/posts', { headers: { Cookie: cookie } }))
        .status,
      200,
    );
  } finally {
    fixture.state.largeMetadata = false;
  }
});
