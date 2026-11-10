// Read-only cloud regression audit. Optional comparison with recovered migration sources.
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPublicSupabaseClient } from '../packages/shared/dist/content.js';
const db = createPublicSupabaseClient(process.env);
const sourceRoot = process.argv
  .find((arg) => arg.startsWith('--source-root='))
  ?.slice(14);
const known = [
  'bi-kip-giao-tiep-da-chieu-2026',
  'nhac-dang-ky-bi-kip-giao-tiep-2026',
  'hoc-bong-sinh-vien-2026-2027',
  'chuyen-xe-doan-vien-2026',
  'xuan-tinh-nguyen-2026',
];
const sources = new Map();
if (sourceRoot)
  for (const kind of ['information', 'scholarships', 'events']) {
    for (const entry of await readdir(`${sourceRoot}/${kind}`, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue;
      const folder = `${sourceRoot}/${kind}/${entry.name}`;
      const metadata = JSON.parse(
        await readFile(`${folder}/metadata.json`, 'utf8'),
      );
      sources.set(metadata.slug, { metadata, folder });
    }
  }
const { data, error } = await db
  .from('posts')
  .select('*,post_media(*),scholarship_details(*),event_details(*)');
if (error) throw new Error(`Cloud read failed (${error.code || 'network'})`);
for (const slug of known)
  if (!data.some((p) => p.slug === slug))
    throw new Error(
      `Missing regression slug: ${slug}; review editorial changes, do not reimport automatically`,
    );
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const report = [];
for (const p of data) {
  if (!p.content?.trim() || p.status !== 'published')
    throw new Error(`Unexpected public content: ${p.slug}`);
  if (p.kind === 'event' && !p.event_details)
    throw new Error(`Missing event details: ${p.slug}`);
  if (p.kind === 'scholarship' && !p.scholarship_details)
    throw new Error(`Missing scholarship details: ${p.slug}`);
  const source = sources.get(p.slug);
  const media = p.post_media.sort((a, b) => a.sort_order - b.sort_order);
  if (source) {
    const content = await readFile(`${source.folder}/content.md`, 'utf8');
    if (p.content.trim() !== content.trim() || p.kind !== source.metadata.kind)
      throw new Error(`Content differs: ${p.slug}; review editorial changes`);
    if (media.length !== source.metadata.images.length)
      throw new Error(`Media count differs: ${p.slug}`);
  }
  for (const [i, image] of media.entries()) {
    if (
      image.bucket !== 'post-media' ||
      image.sort_order !== i ||
      !image.width ||
      !image.height
    )
      throw new Error(`Invalid media metadata: ${p.slug}/${i}`);
    const url = db.storage.from(image.bucket).getPublicUrl(image.storage_path)
      .data.publicUrl;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (
      !response.ok ||
      !response.headers.get('content-type')?.startsWith('image/')
    )
      throw new Error(`Media inaccessible: ${p.slug}/${i}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (source) {
      const expected = source.metadata.images[i];
      if (
        image.width !== expected.width ||
        image.height !== expected.height ||
        hash(bytes) !==
          hash(await readFile(`${source.folder}/${expected.path}`))
      )
        throw new Error(`Media differs: ${p.slug}/${i}`);
    }
  }
  report.push({
    slug: p.slug,
    kind: p.kind,
    content: source ? 'matches source' : 'present',
    images: media.length,
    storage: source ? 'public, bytes match' : 'public, accessible',
    cover: media.some((m) => m.is_cover),
    precision: p.published_at_precision,
  });
}
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      access: 'publishable key / RLS',
      visiblePosts: data.length,
      posts: report,
      writes: 0,
    },
    null,
    2,
  ),
);
