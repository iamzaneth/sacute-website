import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import {
  deriveLifecycle,
  scheduleInstant,
  scheduleFields,
  canTransition,
} from '../packages/shared/dist/index.js';
import { editSnapshot } from '../apps/web/app/features/admin/model.ts';
import { startAdminFixture, adminID } from './support/admin-supabase.mjs';
import { testKey } from './support/supabase.mjs';
const origin = 'http://127.0.0.1:4205',
  readonly = 'http://127.0.0.1:4206',
  initial = '2030-11-10T00:00:00.000Z';
let fixture, cookie, readerCookie;
const children = [];
const find = (id) => fixture.state.rows.find((row) => row.id === id);
async function login(email = 'admin@example.test', base = origin) {
  const response = await fetch(base + '/admin/login', {
    method: 'POST',
    headers: { Origin: base },
    body: new URLSearchParams({ email, password: 'synthetic-password' }),
    redirect: 'manual',
  });
  return response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}
async function request(
  path,
  { form, base = origin, session = cookie, headers = {} } = {},
) {
  return fetch(base + path, {
    method: form ? 'POST' : 'GET',
    headers: { ...(form ? { Origin: base } : {}), Cookie: session, ...headers },
    body: form ? new URLSearchParams(form) : undefined,
    redirect: 'manual',
  });
}
const gallery = [
  {
    bucket: 'post-media',
    storage_path: 'synthetic/0.png',
    alt_text: 'Keep first',
    width: 1,
    height: 1,
    is_cover: false,
  },
  {
    bucket: 'post-media',
    storage_path: 'synthetic/1.png',
    alt_text: 'Keep cover',
    width: 1,
    height: 1,
    is_cover: true,
  },
];
function editorForm(slug, extra = {}) {
  return {
    title: `Lifecycle ${slug}`,
    slug,
    summary: 'Lifecycle summary',
    content: 'Lifecycle full content',
    category: 'Thông báo',
    tags: 'one,two',
    source_url: 'https://example.test/source',
    kind: 'information',
    content_format: 'plain-text',
    intent: 'draft',
    media: JSON.stringify(gallery),
    ...extra,
  };
}
async function create(slug, extra = {}) {
  const response = await request('/admin/posts/new', {
    form: editorForm(slug, extra),
  });
  assert.equal(response.status, 303, await response.text());
  return response.headers.get('location').match(/posts\/([^/]+)\/edit/)[1];
}
async function transition(id, intent, extra = {}, expected = 303) {
  const response = await request('/admin/posts', {
    form: {
      id,
      intent,
      revision: find(id).lifecycle_revision,
      confirmed: 'yes',
      ...extra,
    },
  });
  assert.equal(response.status, expected, await response.text());
  return response;
}
const visible = async (slug) =>
  (await request('/posts/' + slug, { session: '' })).status;
before(async () => {
  fixture = await startAdminFixture();
  fixture.state.now = initial;
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
    child.stderr.on('data', (c) => (errors += c));
    let ready = false;
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null) throw Error(errors);
      try {
        if ((await fetch(base + '/admin/login')).ok) {
          ready = true;
          break;
        }
      } catch {
        /* startup */
      }
      await delay(50);
    }
    assert.ok(ready, errors);
  }
  cookie = await login();
  readerCookie = await login('reader@example.test');
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
test('central lifecycle derivation uses an explicit clock, with Trash taking priority', () => {
  const row = {
    status: 'published',
    deleted_at: null,
    visible_from: '2030-11-15T00:00:00Z',
  };
  assert.equal(deriveLifecycle(row, initial), 'scheduled');
  assert.equal(deriveLifecycle(row, row.visible_from), 'published');
  assert.equal(
    deriveLifecycle({ ...row, deleted_at: initial }, initial),
    'trashed',
  );
  assert.equal(
    deriveLifecycle({ ...row, status: 'archived' }, initial),
    'archived',
  );
  assert.equal(deriveLifecycle({ ...row, status: 'draft' }, initial), 'draft');
  assert.equal(canTransition('archived', 'publish'), false);
  assert.equal(canTransition('trashed', 'restore_trash'), true);
  assert.equal(
    scheduleInstant('2030-11-15', '07:00', 'Asia/Ho_Chi_Minh'),
    '2030-11-15T00:00:00.000Z',
  );
  assert.equal(
    scheduleInstant('2030-11-15', '07:00', 'UTC'),
    '2030-11-15T07:00:00.000Z',
  );
  assert.deepEqual(scheduleFields('2030-11-14T18:00:00Z'), {
    date: '2030-11-15',
    time: '01:00',
  });
  for (const [day, time, zone] of [
    ['2030-02-30', '07:00', 'UTC'],
    ['2030-11-15', '24:00', 'UTC'],
    ['2030-11-15', '07:00', 'unknown'],
  ])
    assert.throws(() => scheduleInstant(day, time, zone));
});
test('draft, schedule, content save, reschedule and query-time publication preserve data', async () => {
  fixture.state.now = initial;
  const id = await create('scheduled-flow'),
    row = find(id);
  assert.equal(row.status, 'draft');
  assert.equal(row.visible_from, null);
  assert.equal(await visible(row.slug), 404);
  await transition(id, 'schedule', {
    schedule_date: '2030-11-15',
    schedule_time: '07:00',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(row.visible_from, '2030-11-15T00:00:00.000Z');
  const before = row.visible_from;
  const edited = await request(`/admin/posts/${id}/edit`, {
    form: editorForm(row.slug, {
      title: 'Lifecycle edited schedule',
      intent: 'save',
      revision: row.lifecycle_revision,
      expected: JSON.stringify(editSnapshot(row)),
      visible_from: initial,
    }),
  });
  assert.equal(edited.status, 303);
  assert.equal(row.visible_from, before);
  await transition(id, 'reschedule', {
    schedule_date: '2030-11-16',
    schedule_time: '09:30',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(row.visible_from, '2030-11-16T02:30:00.000Z');
  for (const path of [
    '/',
    '/information?q=Lifecycle',
    '/scholarships',
    '/events',
  ]) {
    const html = await (await request(path, { session: '' })).text();
    assert.doesNotMatch(html, /Lifecycle edited schedule/);
  }
  fixture.state.now = '2030-11-16T02:29:59.999Z';
  assert.equal(await visible(row.slug), 404);
  const revision = row.lifecycle_revision;
  fixture.state.now = row.visible_from;
  assert.equal(await visible(row.slug), 200);
  assert.equal(
    row.lifecycle_revision,
    revision,
    'query-time publication requires no write/worker',
  );
  assert.match(
    await (await request('/information?q=Lifecycle', { session: '' })).text(),
    /Lifecycle edited schedule/,
  );
  assert.match(
    await (await request('/', { session: '' })).text(),
    /Lifecycle edited schedule/,
  );
  fixture.state.now = initial;
});
test('cancel schedule, publish now, hide, republish, archive and restore are reversible', async () => {
  const id = await create('reversible-flow'),
    row = find(id);
  const originalMedia = JSON.stringify(row.post_media);
  await transition(id, 'schedule', {
    schedule_date: '2030-11-15',
    schedule_time: '07:00',
    timezone: 'UTC',
  });
  await transition(id, 'cancel_schedule');
  assert.equal(row.status, 'draft');
  assert.equal(row.visible_from, null);
  await transition(id, 'schedule', {
    schedule_date: '2030-11-15',
    schedule_time: '07:00',
    timezone: 'UTC',
  });
  await transition(id, 'publish');
  assert.equal(row.visible_from, null);
  assert.equal(row.published_at, initial);
  assert.equal(await visible(row.slug), 200);
  const originalPublication = row.published_at;
  await transition(id, 'hide');
  assert.equal(await visible(row.slug), 404);
  assert.equal(row.slug, 'reversible-flow');
  fixture.state.now = '2030-11-11T01:00:00.000Z';
  await transition(id, 'publish');
  assert.equal(
    row.published_at,
    originalPublication,
    'republishing must retain historical date',
  );
  await transition(id, 'archive');
  assert.equal(row.status, 'archived');
  assert.equal(row.visible_from, null);
  assert.equal(await visible(row.slug), 404);
  await transition(id, 'restore_archive');
  assert.equal(row.status, 'draft');
  assert.equal(row.visible_from, null);
  assert.equal(JSON.stringify(row.post_media), originalMedia);
  assert.equal(row.content, 'Lifecycle full content');
  fixture.state.now = initial;
});
test('Trash excludes normal/public queries, preserves all relations and restores only to Draft', async () => {
  for (const [kind, extra] of [
    [
      'scholarship',
      {
        scholarship_status: 'open',
        provider: 'Provider kept',
        eligibility: 'Eligibility kept',
      },
    ],
    [
      'event',
      {
        event_status: 'upcoming',
        event_name: 'Event kept',
        starts_on: '2030-11-20',
        ends_on: '2030-11-21',
        location: 'Location kept',
      },
    ],
  ]) {
    const id = await create(`trash-${kind}`, { kind, ...extra }),
      row = find(id);
    await transition(id, 'publish');
    const kept = JSON.stringify({
      media: row.post_media,
      scholarship: row.scholarship_details,
      event: row.event_details,
      tags: row.tags,
      source_url: row.source_url,
      content: row.content,
      published_at: row.published_at,
    });
    const storageWrites =
      fixture.state.storageRequests?.filter(
        (r) =>
          r.method === 'DELETE' ||
          r.path.startsWith('/storage/v1/object/draft-media/'),
      ).length ?? 0;
    await transition(id, 'trash');
    assert.equal(row.deleted_by, adminID);
    assert.ok(row.deleted_at);
    assert.equal(await visible(row.slug), 404);
    assert.doesNotMatch(
      await (await request('/admin/posts')).text(),
      new RegExp(`Lifecycle trash-${kind}`),
    );
    assert.match(
      await (await request('/admin/posts?status=trashed')).text(),
      new RegExp(`Lifecycle trash-${kind}`),
    );
    await transition(id, 'permanent_delete', {}, 501);
    await transition(id, 'restore_trash');
    assert.equal(row.deleted_at, null);
    assert.equal(row.deleted_by, null);
    assert.equal(row.status, 'draft');
    assert.equal(row.visible_from, null);
    assert.equal(await visible(row.slug), 404);
    assert.equal(
      JSON.stringify({
        media: row.post_media,
        scholarship: row.scholarship_details,
        event: row.event_details,
        tags: row.tags,
        source_url: row.source_url,
        content: row.content,
        published_at: row.published_at,
      }),
      kept,
    );
    assert.equal(
      fixture.state.storageRequests?.filter(
        (r) =>
          r.method === 'DELETE' ||
          r.path.startsWith('/storage/v1/object/draft-media/'),
      ).length ?? 0,
      storageWrites,
    );
  }
});
test('restore rejects slug collisions without overwriting data', async () => {
  const id = await create('reserved-slug'),
    row = find(id);
  await transition(id, 'trash');
  const duplicate = { ...row, id: crypto.randomUUID(), deleted_at: null };
  fixture.state.rows.push(duplicate);
  await transition(id, 'restore_trash', {}, 422);
  assert.ok(row.deleted_at);
  assert.equal(duplicate.id, fixture.state.rows.at(-1).id);
  fixture.state.rows.pop();
});
test('invalid dates, past DB times, stale edits and expired scheduled actions reject safely', async () => {
  const id = await create('invalid-flow'),
    row = find(id);
  for (const extra of [
    { schedule_date: '2030-02-30', schedule_time: '07:00', timezone: 'UTC' },
    { schedule_date: '2027-11-15', schedule_time: '07:00', timezone: 'UTC' },
    { schedule_date: '2030-11-15', schedule_time: '07:00', timezone: 'bad' },
  ])
    await transition(id, 'schedule', extra, 422);
  const old = row.lifecycle_revision;
  await transition(id, 'schedule', {
    schedule_date: '2030-11-15',
    schedule_time: '07:00',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  await transition(id, 'cancel_schedule', { revision: old }, 409);
  assert.equal(row.visible_from, '2030-11-15T00:00:00.000Z');
  fixture.state.now = row.visible_from;
  await transition(id, 'cancel_schedule', {}, 422);
  await transition(
    id,
    'reschedule',
    { schedule_date: '2030-11-16', schedule_time: '07:00', timezone: 'UTC' },
    422,
  );
  assert.equal(row.status, 'published');
  fixture.state.now = initial;
});
test('every lifecycle mutation enforces auth, CSRF and both write gates', async () => {
  const id = await create('protected-flow'),
    row = find(id);
  for (const session of ['', readerCookie]) {
    const response = await request('/admin/posts', {
      session,
      form: {
        id,
        revision: row.lifecycle_revision,
        intent: 'trash',
        confirmed: 'yes',
      },
    });
    assert.equal(response.status, session ? 403 : 302);
  }
  const csrf = await request('/admin/posts', {
    form: {
      id,
      revision: row.lifecycle_revision,
      intent: 'trash',
      confirmed: 'yes',
    },
    headers: { Origin: 'https://evil.test' },
  });
  assert.ok([400, 403].includes(csrf.status));
  for (const intent of [
    'publish',
    'schedule',
    'reschedule',
    'cancel_schedule',
    'hide',
    'archive',
    'restore_archive',
    'trash',
    'restore_trash',
    'permanent_delete',
  ])
    assert.equal(
      (
        await request('/admin/posts', {
          base: readonly,
          form: {
            id,
            revision: row.lifecycle_revision,
            intent,
            confirmed: 'yes',
          },
        })
      ).status,
      503,
    );
  fixture.state.databaseWrites = false;
  try {
    assert.equal(
      (
        await request('/admin/posts', {
          form: {
            id,
            revision: row.lifecycle_revision,
            intent: 'trash',
            confirmed: 'yes',
          },
        })
      ).status,
      503,
    );
  } finally {
    fixture.state.databaseWrites = true;
  }
  const unconfirmed = await request('/admin/posts', {
    form: { id, revision: row.lifecycle_revision, intent: 'trash' },
  });
  assert.equal(unconfirmed.status, 422);
  assert.equal(row.deleted_at, null);
});
test('deleted rows stay private even if their raw status is still published', async () => {
  const id = await create('deleted-published'),
    row = find(id);
  await transition(id, 'publish');
  row.deleted_at = initial;
  assert.equal(await visible(row.slug), 404);
  assert.doesNotMatch(
    await (
      await request('/information?q=deleted-published', { session: '' })
    ).text(),
    /Lifecycle deleted-published/,
  );
});
