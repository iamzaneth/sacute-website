/**
 * SACUTE: migrate canonical apps/api/mock-data/posts into Supabase.
 *
 * Run at repository root, using Node >= 22.12:
 *   node scripts/migrate-sacute-posts.mjs --dry-run
 *   node --env-file=apps/api/.env scripts/migrate-sacute-posts.mjs --apply
 *
 * Run with --apply only against a project initialized using
 * sacute_supabase_init.sql. Does not delete or overwrite existing rows/files.
 * Re-running repairs missing details/media after a partial import.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const allowedFlags = ['--dry-run', '--apply', '--help'];
const other = args.filter(
  (x) => !allowedFlags.includes(x) && !x.startsWith('--root='),
);

if (other.length || (args.includes('--apply') && args.includes('--dry-run'))) {
  throw new Error(
    `Invalid arguments: ${other.join(' ') || '--apply + --dry-run'}`,
  );
}

if (args.includes('--help')) {
  console.log(
    `SACUTE post import

  node scripts/migrate-sacute-posts.mjs --dry-run
  node --env-file=apps/api/.env scripts/migrate-sacute-posts.mjs --apply

Optional: --root=/absolute/path/to/repo

--apply creates missing posts/details/media only.
It never deletes or updates existing records or overwrites Storage files.`,
  );
  process.exit(0);
}

const rootArg = args.find((arg) => arg.startsWith('--root='));
const root = rootArg ? path.resolve(rootArg.slice(7)) : defaultRoot;

const apply = args.includes('--apply');
const contentRoot = path.join(root, 'apps/api/mock-data/posts');

const kindByDirectory = {
  information: 'information',
  scholarships: 'scholarship',
  events: 'event',
};

const mimeByExt = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

const maxImageSize = 10 * 1024 * 1024;

const assert = (condition, description) => {
  if (!condition) throw new Error(description);
};

const requireString = (value, name) => {
  assert(
    typeof value === 'string' && value.trim().length > 0,
    `Missing ${name}`,
  );
  return value;
};

const optionalDate = (value, name) => {
  if (value == null || value === '') return null;

  assert(
    typeof value === 'string' && Number.isFinite(Date.parse(value)),
    `Invalid ${name}: ${value}`,
  );

  return value;
};

const optionalDateTime = (value, name) => {
  const result = optionalDate(value, name);
  if (result === null) return null;

  assert(
    /T\d{2}:\d{2}/.test(result) && /(Z|[+-]\d{2}:\d{2})$/.test(result),
    `${name} must be ISO datetime with timezone offset: ${value}`,
  );

  return result;
};

async function loadSources() {
  const posts = [];
  const ids = new Set();
  const slugs = new Set();

  for (const [directory, expectedKind] of Object.entries(kindByDirectory)) {
    const collectionPath = path.join(contentRoot, directory);
    const entries = await readdir(collectionPath, {
      withFileTypes: true,
    });

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;

      const folder = path.join(collectionPath, entry.name);
      const m = JSON.parse(
        await readFile(path.join(folder, 'metadata.json'), 'utf8'),
      );

      assert(m.kind === expectedKind, `Incorrect kind in ${folder}`);

      requireString(m.id, `${folder}/id`);
      requireString(m.slug, `${folder}/slug`);
      requireString(m.title, `${folder}/title`);
      requireString(m.summary, `${folder}/summary`);
      requireString(m.category, `${folder}/category`);

      assert(
        m.slug === entry.name && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.slug),
        `Invalid slug/path for ${folder}`,
      );

      assert(
        !ids.has(m.id) && !slugs.has(m.slug),
        `Duplicate id/slug: ${m.slug}`,
      );

      ids.add(m.id);
      slugs.add(m.slug);

      assert(
        m.contentFile === 'content.md',
        `Expected content.md in ${folder}`,
      );

      assert(
        m.contentFormat === 'plain-text' || m.contentFormat === 'markdown',
        `Unsupported contentFormat in ${folder}`,
      );

      assert(
        ['published', 'draft', 'archived'].includes(m.publicationStatus),
        `Unexpected publicationStatus in ${folder}`,
      );

      const content = (
        await readFile(path.join(folder, 'content.md'), 'utf8')
      ).trimEnd();

      const precision =
        m.publishedAtPrecision ??
        (m.publishedAt?.includes('T') ? 'datetime' : 'date');

      assert(
        ['date', 'datetime'].includes(precision),
        `Invalid publishedAtPrecision: ${folder}`,
      );

      const publishedAt = optionalDate(m.publishedAt, `${folder}/publishedAt`);

      if (publishedAt && precision === 'datetime') {
        optionalDateTime(publishedAt, 'publishedAt');
      }

      if (publishedAt && precision === 'date') {
        assert(
          /^\d{4}-\d{2}-\d{2}$/.test(publishedAt),
          `Date-only precision requires YYYY-MM-DD in ${folder}`,
        );
      }

      const images = [];

      for (const [index, img] of (m.images ?? []).entries()) {
        assert(
          typeof img.path === 'string' &&
            /^images\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/i.test(
              img.path,
            ),
          `Unsafe/unsupported image filename in ${folder}`,
        );

        const filename = path.basename(img.path);
        const absolutePath = path.join(folder, 'images', filename);
        const imageStat = await stat(absolutePath);

        assert(
          imageStat.isFile() && imageStat.size <= maxImageSize,
          `Image missing/too large: ${absolutePath}`,
        );

        images.push({
          index,
          filename,
          absolutePath,
          size: imageStat.size,
          mime: mimeByExt[path.extname(filename).toLowerCase()],
          alt_text: img.alt ?? '',
          width:
            Number.isInteger(img.width) && img.width > 0 ? img.width : null,
          height:
            Number.isInteger(img.height) && img.height > 0 ? img.height : null,
          source_metadata: {
            original_path: img.path,
            ...(img.sourceFile ? { original_source_file: img.sourceFile } : {}),
          },
        });
      }

      // Validate dates before any network write.
      if (m.kind === 'scholarship') {
        optionalDateTime(m.opensAt, 'scholarship.opensAt');
        optionalDateTime(m.closesAt, 'scholarship.closesAt');
      }

      if (m.kind === 'event') {
        optionalDateTime(m.startsAt, 'event.startsAt');
        optionalDateTime(m.endsAt, 'event.endsAt');
        optionalDate(m.startsOn, 'event.startsOn');
        optionalDate(m.endsOn, 'event.endsOn');
      }

      posts.push({
        m,
        content,
        folder,
        precision,
        publishedAt,
        images,
      });
    }
  }

  return posts;
}

function postRow(item) {
  const { m, content, publishedAt, precision } = item;

  return {
    legacy_id: m.id,
    slug: m.slug,
    kind: m.kind,
    category: m.category,
    title: m.title,
    original_title: m.originalTitle ?? null,
    event_name: m.eventName ?? null,
    summary: m.summary,
    content,
    content_format: m.contentFormat,
    tags: m.tags ?? [],
    author_name: m.author?.name ?? null,
    author_url: m.author?.url ?? null,
    source_url: m.source?.url ?? null,
    source_platform: m.source?.platform ?? null,
    source_metadata: {
      ...(m.source?.postId ? { source_post_id: m.source.postId } : {}),
      ...(typeof m.source?.contentComplete === 'boolean'
        ? { content_complete: m.source.contentComplete }
        : {}),
      ...(m.editorialNotes?.length
        ? { editorial_notes: m.editorialNotes }
        : {}),
    },
    featured: m.featured === true,
    status: m.publicationStatus,
    published_on: publishedAt ? publishedAt.slice(0, 10) : null,
    published_at: precision === 'datetime' ? publishedAt : null,
    published_at_precision: publishedAt ? precision : null,
  };
}

function detailRow(item, postId) {
  const m = item.m;

  if (m.kind === 'scholarship') {
    return {
      table: 'scholarship_details',
      row: {
        post_id: postId,
        provider: m.provider ?? null,
        eligibility: m.eligibility ?? null,
        opens_at: m.opensAt ?? null,
        closes_at: m.closesAt ?? null,
        application_url: m.applicationUrl ?? null,
        lifecycle_status: m.status ?? null,
      },
    };
  }

  if (m.kind === 'event') {
    return {
      table: 'event_details',
      row: {
        post_id: postId,
        starts_at: m.startsAt ?? null,
        ends_at: m.endsAt ?? null,
        starts_on: m.startsOn ?? null,
        ends_on: m.endsOn ?? null,
        location: m.location ?? null,
        registration_url: m.registrationUrl ?? null,
        lifecycle_status: m.status ?? null,
      },
    };
  }

  return null;
}

function check({ error, data }, label) {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data;
}

async function main() {
  const items = await loadSources();

  const totalImages = items.reduce((sum, x) => sum + x.images.length, 0);

  const totalBytes = items.reduce(
    (sum, x) => sum + x.images.reduce((n, img) => n + img.size, 0),
    0,
  );

  console.log(
    `Validated ${items.length} posts, ${totalImages} images, ` +
      `${(totalBytes / 1048576).toFixed(2)} MiB`,
  );

  for (const { m, images } of items) {
    console.log(
      ` - ${m.kind.padEnd(11)} ${m.slug} | ` +
        `${m.publicationStatus} | ${images.length} image(s)`,
    );
  }

  if (!apply) {
    console.log(
      '\nDry-run only: NO Supabase writes were made. ' +
        'Pass --apply to import.',
    );
    return;
  }

  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  assert(
    url && secret,
    'Set SUPABASE_URL and SUPABASE_SECRET_KEY in apps/api/.env',
  );

  const parsedUrl = new URL(url);

  assert(
    parsedUrl.protocol === 'https:' &&
      /^https:\/\/[^/]+\.supabase\.co\/?$/.test(url),
    'SUPABASE_URL should look like https://xxxx.supabase.co',
  );

  assert(
    secret !== process.env.SUPABASE_PUBLISHABLE_KEY,
    'Do not use the publishable key for this admin migration',
  );

  // Never expose the secret key in browser code.
  const { createClient } = await import('@supabase/supabase-js');

  const db = createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const counters = {
    posts: 0,
    details: 0,
    media: 0,
    uploads: 0,
    skippedPosts: 0,
  };

  for (const item of items) {
    const m = item.m;

    let post = check(
      await db
        .from('posts')
        .select('id,slug,legacy_id,kind,status')
        .eq('slug', m.slug)
        .maybeSingle(),
      `Lookup post ${m.slug}`,
    );

    if (post) {
      assert(
        post.legacy_id === m.id && post.kind === m.kind,
        `Existing slug '${m.slug}' has another legacy_id/kind. ` +
          'Resolve manually; not overwritten.',
      );

      counters.skippedPosts++;
      console.log(`EXISTING post ${m.slug}: keep database version`);
    } else {
      const rows = check(
        await db
          .from('posts')
          .insert(postRow(item))
          .select('id,slug,legacy_id,kind,status')
          .single(),
        `Insert post ${m.slug}`,
      );

      post = rows;
      counters.posts++;
      console.log(`CREATED  post ${m.slug}`);
    }

    const detail = detailRow(item, post.id);

    if (detail) {
      const old = check(
        await db
          .from(detail.table)
          .select('post_id')
          .eq('post_id', post.id)
          .maybeSingle(),
        `Lookup ${detail.table}: ${m.slug}`,
      );

      if (!old) {
        check(
          await db.from(detail.table).insert(detail.row),
          `Insert ${detail.table}: ${m.slug}`,
        );
        counters.details++;
      }
    }

    for (const img of item.images) {
      // Reuse database status if an editor changed the imported post.
      const bucket = post.status === 'published' ? 'post-media' : 'draft-media';

      const key =
        `posts/${post.id}/` +
        `${String(img.index + 1).padStart(2, '0')}-${img.filename}`;

      const target = db.storage.from(bucket);
      const bytes = await readFile(img.absolutePath);

      const result = await target.upload(key, bytes, {
        contentType: img.mime,
        upsert: false,
      });

      if (result.error) {
        const duplicate =
          String(result.error.statusCode) === '409' ||
          /already exists|resource already exists|duplicate/i.test(
            result.error.message,
          );

        if (!duplicate) {
          throw new Error(`Upload ${bucket}/${key}: ${result.error.message}`);
        }
      } else {
        counters.uploads++;
      }

      const oldMedia = check(
        await db
          .from('post_media')
          .select('id,post_id')
          .eq('bucket', bucket)
          .eq('storage_path', key)
          .maybeSingle(),
        `Lookup media: ${key}`,
      );

      if (oldMedia) {
        assert(
          oldMedia.post_id === post.id,
          `Storage path assigned to another post: ${key}`,
        );
      } else {
        check(
          await db.from('post_media').insert({
            post_id: post.id,
            bucket,
            storage_path: key,
            alt_text: img.alt_text,
            width: img.width,
            height: img.height,
            sort_order: img.index,
            is_cover: img.index === 0,
            source_metadata: img.source_metadata,
          }),
          `Insert media: ${key}`,
        );

        counters.media++;
      }
    }
  }

  console.log(
    `\nFinished: ${JSON.stringify(counters)}\n` +
      'Existing posts/details/media are not overwritten. ' +
      'Review in Supabase Table Editor.',
  );
}

main().catch((error) => {
  console.error(`\nMigration stopped: ${error.message}`);
  console.error(
    'No automatic rollback across Storage and PostgreSQL. ' +
      'Fix the issue and rerun --apply (idempotent).',
  );
  process.exitCode = 1;
});
