import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPublicSupabaseClient,
  SupabaseContentRepository,
  mapPost,
  ContentError,
  validateSupabaseEnvironment,
} from '../packages/shared/dist/content.js';
import { startFixtureDatabase, testKey, rows } from './support/supabase.mjs';
let fixture, db, store;
before(async () => {
  fixture = await startFixtureDatabase();
  db = createPublicSupabaseClient({
    SUPABASE_URL: fixture.url,
    SUPABASE_PUBLISHABLE_KEY: testKey,
  });
  store = new SupabaseContentRepository(db);
});
after(async () => fixture.close());
test('public queries filter in PostgreSQL, use stable sorting and one embedded query', async () => {
  const start = fixture.state.requests.length;
  const result = await store.list('information', {
    limit: 1,
    page: 2,
    q: 'HỖ TRỢ',
    category: 'Thông báo',
  });
  assert.equal(result.meta.total, 2);
  assert.equal(result.data[0].id, 'older');
  assert.equal(fixture.state.requests.length - start, 1);
  const url = fixture.state.requests.at(-1);
  assert.equal(url.searchParams.get('status'), 'eq.published');
  assert.ok(
    url.searchParams.getAll('or').some((s) => s.includes('visible_from.lte.')),
  );
  assert.equal(url.searchParams.get('offset'), '1');
  assert.equal(url.searchParams.get('limit'), '1');
  assert.equal(
    url.searchParams.get('order'),
    'published_on.desc.nullslast,published_at.desc.nullslast,id.asc',
  );
  assert.match(url.searchParams.get('select'), /post_media\(/);
});
test('information feed includes events once and retains their actual kind', async () => {
  const all = await store.list('information');
  assert.equal(all.meta.total, 3);
  const events = await store.list('information', { category: 'Hoạt động' });
  assert.equal(events.data.length, 1);
  assert.equal(events.data[0].kind, 'event');
  assert.equal(events.data[0].category, 'Hoạt động');
  const event = await store.getPostBySlug(events.data[0].slug);
  assert.equal(event.category, 'Xuân tình nguyện');
});
test('scholarship and event fields and publication precision map correctly', async () => {
  const scholarship = (await store.list('scholarships')).data[0];
  assert.equal(scholarship.closesAt, '2026-12-01T00:00:00Z');
  assert.equal(scholarship.status, 'open');
  const event = (await store.list('events', { category: 'Xuân tình nguyện' }))
    .data[0];
  assert.equal(event.startsOn, '2026-01-01');
  assert.equal(event.publishedAt, '2026-01-01');
  const timestamp = await store.getPostBySlug('bai-thu-nghiem-notice');
  assert.equal(timestamp.publishedAt, '2026-01-03T01:30:00Z');
});
test('media keeps gallery order while selecting cover separately, omits private/invalid records and dimensions', () => {
  const row = structuredClone(rows[0]);
  row.post_media.push({
    ...row.post_media[0],
    id: 'private',
    bucket: 'draft-media',
  });
  row.post_media[1].width = null;
  row.post_media[1].height = null;
  const mapped = mapPost(row, db);
  assert.deepEqual(
    mapped.images.map((i) => i.url.split('/').at(-1)),
    ['0.png', '1.png', '2.png'],
  );
  assert.ok(mapped.coverImage.url.endsWith('2.png'));
  assert.equal(mapped.images[0].width, undefined);
  assert.equal(mapped.images[0].height, undefined);
  assert.equal(mapPost(rows[1], db).images.length, 0);
});
test('draft, archived, future and unknown slugs remain private', async () => {
  for (const id of ['draft', 'archived', 'future', 'missing'])
    assert.equal(await store.getPostBySlug(`bai-thu-nghiem-${id}`), null);
  assert.throws(() => mapPost(rows[4], db), ContentError);
});
test('search filter grammar cannot widen publication constraints', async () => {
  for (const q of ['a,b)"*%', 'Thông báo', 'HỖ TRỢ']) {
    const result = await store.list('information', { q });
    assert.ok(
      result.data.every((p) => ['notice', 'older', 'event'].includes(p.id)),
    );
  }
});
test('database errors and timeouts remain distinct from empty results', async () => {
  fixture.state.fail = true;
  await assert.rejects(store.list('events'), (e) => e.code === 'query');
  fixture.state.fail = false;
  const client = createPublicSupabaseClient(
    { SUPABASE_URL: fixture.url, SUPABASE_PUBLISHABLE_KEY: testKey },
    async () => {
      throw new DOMException('timeout', 'TimeoutError');
    },
  );
  await assert.rejects(
    new SupabaseContentRepository(client).list('events'),
    (e) => e.code === 'timeout',
  );
  assert.equal((await store.list('events', { q: 'unmatched' })).meta.total, 0);
});
test('missing config and privileged keys are rejected', () => {
  for (const env of [
    {},
    {
      SUPABASE_URL: fixture.url,
      SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private',
    },
    {
      SUPABASE_URL: fixture.url,
      SUPABASE_PUBLISHABLE_KEY: `x.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.x`,
    },
  ])
    assert.throws(
      () => validateSupabaseEnvironment(env),
      (e) => e.code === 'configuration',
    );
});

test('equal publication dates use deterministic id ordering across pages', async () => {
  const baseline = fixture.state.rows;
  fixture.state.rows = ['z', 'a', 'm'].map((id) => ({
    ...structuredClone(rows[0]),
    id,
    slug: `tie-${id}`,
  }));
  try {
    const first = await store.list('information', { limit: 2 });
    const second = await store.list('information', { limit: 2, page: 2 });
    assert.deepEqual(
      first.data.concat(second.data).map((p) => p.id),
      ['a', 'm', 'z'],
    );
  } finally {
    fixture.state.rows = baseline;
  }
});

test('production sources contain no local mock read paths', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  for (const root of ['apps/web/app', 'apps/api/src', 'packages/shared/src']) {
    const files = await readdir(root, { recursive: true, withFileTypes: true });
    for (const file of files.filter(
      (f) => f.isFile() && /\.tsx?$/.test(f.name),
    )) {
      const source = await readFile(`${file.parentPath}/${file.name}`, 'utf8');
      assert.doesNotMatch(
        source,
        /localContent|mockContent|LocalContentRepository|mock-data|media\/mock/,
      );
    }
  }
});

test('event facets come from all eligible cloud metadata independently of list filters', async () => {
  const baseline = fixture.state.rows;
  fixture.state.rows = baseline.concat({
    ...structuredClone(rows[3]),
    id: 'event-new',
    slug: 'event-new',
    event_name: 'Chương trình mới',
  });
  try {
    const categories = await store.getEventCategories();
    assert.deepEqual(
      new Set(categories),
      new Set(['Xuân tình nguyện', 'Chương trình mới']),
    );
    const query = fixture.state.requests.at(-1);
    assert.equal(query.searchParams.get('select'), 'event_name,category');
    assert.equal(query.searchParams.get('status'), 'eq.published');
    assert.equal(query.searchParams.get('limit'), '500');
    assert.equal(
      (await store.list('events', { category: 'Chương trình mới' })).meta.total,
      1,
    );
  } finally {
    fixture.state.rows = baseline;
  }
});
