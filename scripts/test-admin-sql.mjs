// Explicit opt-in test. Disposable PG16, no network, no ports or production env.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
const container = `sacute-security-${crypto.randomUUID().slice(0, 8)}`;
function command(args, input = '') {
  const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '',
    stderr = '';
  const result = new Promise((resolve, reject) => {
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code, stdout, stderr }));
  });
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  return result;
}
async function sql(input, allowError = false) {
  const result = await command(
    [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-v',
      'VERBOSITY=verbose',
      '-qAt',
    ],
    `SET statement_timeout='8s';\n${input}`,
  );
  if (!allowError) assert.equal(result.code, 0, result.stderr);
  return result;
}
const actor =
  "SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);";
const postOne = '00000000-0000-4000-8000-000000000091',
  postTwo = '00000000-0000-4000-8000-000000000092';
const path =
  'admin/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000093.png';
function input(title, slug, media = []) {
  const value = {
    post: {
      title,
      slug,
      summary: 'Summary',
      content: 'Content',
      kind: 'information',
      category: 'Notice',
      content_format: 'plain-text',
      tags: [],
      status: 'draft',
      published_on: null,
      published_at: null,
      published_at_precision: null,
      visible_from: null,
      source_url: null,
      event_name: null,
    },
    scholarship: null,
    event: null,
    media,
  };
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}
async function waitForWriter(name) {
  for (let n = 0; n < 50; n++) {
    const result = await sql(
      `SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='PgSleep';`,
    );
    if (result.stdout.trim() === '1') return;
    await delay(40);
  }
  throw Error('Concurrent writer did not reach its lock hold');
}
let created = false;
try {
  const started = await command([
    'run',
    '--rm',
    '-d',
    '--name',
    container,
    '--network',
    'none',
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    'postgres:16.6-alpine',
  ]);
  assert.equal(started.code, 0, started.stderr);
  created = true;
  let ready = false;
  for (let n = 0; n < 100; n++) {
    if (
      (
        await command([
          'exec',
          container,
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'postgres',
        ])
      ).code === 0
    ) {
      ready = true;
      break;
    }
    await delay(50);
  }
  assert.ok(ready, 'PostgreSQL startup');
  for (const file of [
    'tests/sql/admin-bootstrap.sql',
    'supabase/migrations/202611100001_private_admin_cms.sql',
    'supabase/migrations/202611100002_admin_security_hardening.sql',
    'supabase/audits/admin_rls_audit.sql',
    'tests/sql/admin-rls.sql',
    'tests/sql/admin-security.sql',
  ]) {
    await sql(await readFile(file, 'utf8'));
    process.stdout.write(`PASS ${file}\n`);
  }
  await sql(
    'CREATE POLICY fixture_hidden_reference ON public.post_media AS RESTRICTIVE FOR SELECT TO authenticated USING(false);',
  );
  const blocked = await sql(
    await readFile(
      'supabase/migrations/202611100002_admin_security_hardening.sql',
      'utf8',
    ),
    true,
  );
  assert.notEqual(
    blocked.code,
    0,
    'Unreviewed restrictive policy was accepted',
  );
  assert.match(blocked.stderr, /Unreviewed restrictive policy/);
  assert.equal(
    (
      await sql(
        "SELECT count(*) FROM pg_policies WHERE policyname='fixture_hidden_reference';",
      )
    ).stdout.trim(),
    '1',
  );
  await sql('DROP POLICY fixture_hidden_reference ON public.post_media;');
  process.stdout.write(
    'PASS unreviewed restrictive policy aborts migration without removing it\n',
  );
  await sql(`UPDATE public.admin_cms_settings SET writes_enabled=true;
 INSERT INTO public.posts(id,slug,kind,title,summary,content,category,content_format,status,tags) VALUES
 ('${postOne}','concurrent-one','information','Original','Summary','Content','Notice','plain-text','draft',ARRAY[]::text[]),
 ('${postTwo}','concurrent-two','information','Original','Summary','Content','Notice','plain-text','draft',ARRAY[]::text[]);
 INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('draft-media','${path}','{"mimetype":"image/png"}');
 CREATE FUNCTION public.fixture_snapshot(v_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
 SELECT jsonb_build_object('post',jsonb_build_object('title',p.title,'slug',p.slug,'summary',p.summary,'content',p.content,'category',p.category,'kind',p.kind,'tags',p.tags,'status',p.status,'published_on',p.published_on,'published_at',p.published_at,'published_at_precision',p.published_at_precision,'visible_from',p.visible_from,'source_url',p.source_url,'event_name',p.event_name,'content_format',p.content_format),'scholarship',NULL,'event',NULL,'media',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'bucket',m.bucket,'storage_path',m.storage_path,'alt_text',m.alt_text,'width',m.width,'height',m.height,'sort_order',m.sort_order,'is_cover',m.is_cover) ORDER BY m.id) FROM public.post_media m WHERE m.post_id=p.id),'[]'::jsonb)) FROM public.posts p WHERE p.id=v_id;
 $$;`);
  const first = sql(
    `SET application_name='cms_review_writer';BEGIN;${actor}SELECT public.admin_save_post('${postOne}',${input('First writer', 'concurrent-one')},public.fixture_snapshot('${postOne}'));SELECT pg_sleep(1.5);COMMIT;`,
  );
  await waitForWriter('cms_review_writer');
  const second = sql(
    `BEGIN;${actor}SELECT public.admin_save_post('${postOne}',${input('Stale writer', 'concurrent-one')},public.fixture_snapshot('${postOne}'));COMMIT;`,
    true,
  );
  await first;
  const stale = await second;
  assert.notEqual(stale.code, 0, 'Stale concurrent save succeeded');
  assert.match(stale.stderr, /40001/);
  assert.equal(
    (
      await sql(`SELECT title FROM public.posts WHERE id='${postOne}';`)
    ).stdout.trim(),
    'First writer',
  );
  process.stdout.write(
    'PASS concurrent RPC saves reject stale snapshot (40001)\n',
  );
  const media = [
    {
      bucket: 'draft-media',
      storage_path: path,
      alt_text: 'Private',
      width: 2,
      height: 2,
      is_cover: true,
    },
  ];
  const attach = sql(
    `SET application_name='cms_review_attachment';BEGIN;${actor}SELECT public.admin_save_post('${postTwo}',${input('Attached', 'concurrent-two', media)},public.fixture_snapshot('${postTwo}'));SELECT pg_sleep(1.5);COMMIT;`,
  );
  await waitForWriter('cms_review_attachment');
  const deletion = sql(
    `BEGIN;${actor}DELETE FROM storage.objects WHERE bucket_id='draft-media' AND name='${path}';COMMIT;`,
    true,
  );
  await attach;
  const deleted = await deletion;
  assert.ok(deleted.code === 0 || /23503/.test(deleted.stderr), deleted.stderr);
  assert.equal(
    (
      await sql(
        `SELECT count(*) FROM storage.objects WHERE bucket_id='draft-media' AND name='${path}';`,
      )
    ).stdout.trim(),
    '1',
  );
  process.stdout.write(
    'PASS concurrent attachment/delete preserves referenced object\n',
  );
  const directPath = path.replace('000000000093', '000000000094');
  await sql(
    `INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('draft-media','${directPath}','{"mimetype":"image/png"}');`,
  );
  const direct = sql(
    `SET application_name='cms_review_direct';BEGIN;${actor}INSERT INTO public.post_media(post_id,bucket,storage_path,alt_text,width,height,sort_order,is_cover) VALUES('${postTwo}','draft-media','${directPath}','Direct',2,2,1,false);SELECT pg_sleep(1.5);COMMIT;`,
  );
  await waitForWriter('cms_review_direct');
  const directDelete = sql(
    `BEGIN;${actor}DELETE FROM storage.objects WHERE bucket_id='draft-media' AND name='${directPath}';COMMIT;`,
    true,
  );
  await direct;
  const directResult = await directDelete;
  assert.ok(
    directResult.code === 0 || /23503/.test(directResult.stderr),
    directResult.stderr,
  );
  assert.equal(
    (
      await sql(
        `SELECT count(*) FROM storage.objects WHERE bucket_id='draft-media' AND name='${directPath}';`,
      )
    ).stdout.trim(),
    '1',
  );
  process.stdout.write(
    'PASS concurrent direct REST-style association/delete preserves object\n',
  );
  await sql(
    await readFile(
      'supabase/migrations/202611100003_post_lifecycle.sql',
      'utf8',
    ),
  );
  process.stdout.write('PASS lifecycle migration (writes remain false)\n');
  await sql(await readFile('tests/sql/post-lifecycle.sql', 'utf8'));
  process.stdout.write(
    'PASS full lifecycle, clock boundary, retention and permission SQL assertions\n',
  );
  await sql('UPDATE public.admin_cms_settings SET writes_enabled=false;');
} finally {
  if (created) await command(['rm', '-f', container]);
}
