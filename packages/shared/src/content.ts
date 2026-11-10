// Server data access entry point. Do not import this module from React components.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { deriveLifecycle } from './lifecycle';
import type {
  ContentItem,
  ContentKind,
  ContentMap,
  ListQuery,
  ListResponse,
  PostImage,
  Scholarship,
  StudentEvent,
} from './index';

export class ContentError extends Error {
  constructor(
    public readonly code:
      'configuration' | 'query' | 'timeout' | 'invalid-data',
    public readonly status = 503,
  ) {
    super(
      {
        configuration: 'Thiếu cấu hình kết nối nội dung.',
        query: 'Không thể tải nội dung. Vui lòng thử lại sau.',
        timeout: 'Kết nối nội dung quá thời gian chờ.',
        'invalid-data': 'Dữ liệu nội dung chưa hợp lệ.',
      }[code],
    );
  }
}
export function validateSupabaseEnvironment(env: Record<string, unknown>) {
  const url = String(env.SUPABASE_URL ?? '').trim();
  const key = String(env.SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  try {
    const parsed = new URL(url);
    if (
      !['https:', 'http:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    )
      throw new Error();
    if (!key || key === 'sb_publishable_' || key.startsWith('sb_secret_'))
      throw new Error();
    // Legacy anon JWTs are supported; service-role JWTs are rejected.
    if (!key.startsWith('sb_publishable_')) {
      const payload = JSON.parse(
        Buffer.from(key.split('.')[1], 'base64url').toString(),
      );
      if (payload.role !== 'anon') throw new Error();
    }
  } catch {
    throw new ContentError('configuration', 500);
  }
  return { url, key };
}
export function createPublicSupabaseClient(
  env: Record<string, unknown>,
  requestFetch: typeof fetch = fetch,
) {
  const { url, key } = validateSupabaseEnvironment(env);
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        try {
          return await requestFetch(input, {
            ...init,
            cache: 'no-store',
            signal: AbortSignal.timeout(10000),
          });
        } catch (error) {
          if (
            error instanceof Error &&
            ['TimeoutError', 'AbortError'].includes(error.name)
          )
            throw new ContentError('timeout');
          throw new ContentError('query');
        }
      },
    },
  });
}
type MediaRow = {
  bucket: string;
  storage_path: string;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_cover: boolean;
  id: string;
};
type ScholarshipRow = {
  provider: string | null;
  eligibility: string | null;
  opens_at: string | null;
  closes_at: string | null;
  application_url: string | null;
  lifecycle_status: Scholarship['status'];
};
type EventRow = {
  starts_at: string | null;
  ends_at: string | null;
  starts_on: string | null;
  ends_on: string | null;
  location: string | null;
  registration_url: string | null;
  lifecycle_status: StudentEvent['status'];
};
export interface PostRow {
  id: string;
  slug: string;
  kind: ContentItem['kind'];
  title: string;
  summary: string;
  category: string;
  content: string;
  content_format: 'plain-text' | 'markdown';
  original_title: string | null;
  event_name: string | null;
  tags: string[] | null;
  author_name: string | null;
  author_url: string | null;
  source_url: string | null;
  status: string;
  visible_from: string | null;
  deleted_at: string | null;
  published_on: string | null;
  published_at: string | null;
  published_at_precision: 'date' | 'datetime' | null;
  post_media: MediaRow[];
  scholarship_details: ScholarshipRow | ScholarshipRow[] | null;
  event_details: EventRow | EventRow[] | null;
}
export type PublicPost = ContentMap[ContentKind];
const optional = <T>(value: T | null) => value ?? undefined;
const one = <T>(value: T | T[] | null) =>
  Array.isArray(value) ? value[0] : value;
const safeUrl = (value: string | null) => {
  try {
    const url = new URL(value ?? '');
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeMediaPath = (path: string) =>
  path.length > 0 &&
  path.length <= 512 &&
  ![...path].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) &&
  !/(^\/|\/\/|\/$|(^|\/)\.\.?($|\/)|[\\?#%])/.test(path);
export const publicMediaHeaders = {
  'Cache-Control': 'no-store',
  'Content-Disposition': 'inline',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
};
export function mapPost(
  row: PostRow,
  db: SupabaseClient,
  now = new Date(),
  mediaPrefix = '/media/posts',
): PublicPost {
  if (row.deleted_at != null || deriveLifecycle(row, now) !== 'published')
    throw new ContentError('invalid-data');
  if (
    !row.id ||
    !row.slug ||
    !row.title ||
    !['information', 'scholarship', 'event'].includes(row.kind)
  )
    throw new ContentError('invalid-data');
  const media = [...(row.post_media ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
  const mapped = media.flatMap((m) => {
    if (
      !['post-media', 'draft-media'].includes(m.bucket) ||
      !safeMediaPath(m.storage_path) ||
      (m.bucket === 'draft-media' && (!uuid.test(row.id) || !uuid.test(m.id)))
    ) {
      console.warn(
        JSON.stringify({
          event: 'content_media_omitted',
          code: 'invalid-public-media',
        }),
      );
      return [];
    }
    const image: PostImage = {
      url:
        m.bucket === 'draft-media'
          ? `${mediaPrefix}/${row.id}/${m.id}`
          : db.storage.from('post-media').getPublicUrl(m.storage_path).data
              .publicUrl,
      alt: m.alt_text ?? '',
      width: m.width && m.width > 0 ? m.width : undefined,
      height: m.height && m.height > 0 ? m.height : undefined,
    };
    return [{ image, cover: m.is_cover }];
  });
  const base: ContentItem = {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    category: row.category,
    content: row.content,
    contentFormat: row.content_format,
    originalTitle: optional(row.original_title),
    eventName: optional(row.event_name),
    publishedAt: optional(
      row.published_at_precision === 'date'
        ? row.published_on
        : row.published_at,
    ),
    publishedAtPrecision: optional(row.published_at_precision),
    authorName: optional(row.author_name),
    authorUrl: safeUrl(row.author_url),
    sourceUrl: safeUrl(row.source_url),
    tags: row.tags ?? [],
    images: mapped.map((m) => m.image),
    coverImage: (mapped.find((m) => m.cover) ?? mapped[0])?.image,
  };
  if (row.kind === 'scholarship') {
    const d = one(row.scholarship_details);
    if (!d || !['upcoming', 'open', 'closed'].includes(d.lifecycle_status))
      throw new ContentError('invalid-data');
    return {
      ...base,
      kind: 'scholarship',
      provider: optional(d?.provider ?? null),
      eligibility: optional(d?.eligibility ?? null),
      opensAt: optional(d?.opens_at ?? null),
      closesAt: optional(d?.closes_at ?? null),
      applicationUrl: safeUrl(d?.application_url ?? null),
      status: d.lifecycle_status,
    };
  }
  if (row.kind === 'event') {
    const d = one(row.event_details);
    if (!d || !['upcoming', 'ongoing', 'ended'].includes(d.lifecycle_status))
      throw new ContentError('invalid-data');
    return {
      ...base,
      kind: 'event',
      startsAt: optional(d?.starts_at ?? null),
      endsAt: optional(d?.ends_at ?? null),
      startsOn: optional(d?.starts_on ?? null),
      endsOn: optional(d?.ends_on ?? null),
      location: optional(d?.location ?? null),
      registrationUrl: safeUrl(d?.registration_url ?? null),
      status: d.lifecycle_status,
    };
  }
  return { ...base, kind: 'information' };
}
export const postSelection =
  'id,slug,kind,category,title,original_title,event_name,summary,content,content_format,tags,author_name,author_url,source_url,status,visible_from,deleted_at,published_on,published_at,published_at_precision,post_media(id,bucket,storage_path,alt_text,width,height,sort_order,is_cover),scholarship_details(provider,eligibility,opens_at,closes_at,application_url,lifecycle_status),event_details(starts_at,ends_at,starts_on,ends_on,location,registration_url,lifecycle_status)';
// JSON quoting protects PostgREST filter grammar; wildcard characters are literal.
const literal = (value: string) => JSON.stringify(value);
const pattern = (value: string) =>
  literal(`%${value.replace(/[\\%_*]/g, '\\$&')}%`);
export class SupabaseContentRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly clock?: () => Date | Promise<Date>,
    private readonly mediaPrefix = '/media/posts',
  ) {}
  async databaseTime() {
    if (this.clock) return this.clock();
    const result = await this.db.rpc('sacute_content_time');
    if (result.error) this.fail(result.error);
    if (
      typeof result.data !== 'string' ||
      !Number.isFinite(Date.parse(result.data))
    )
      throw new ContentError('invalid-data');
    return new Date(result.data);
  }
  private query(now: Date, columns = postSelection) {
    return this.db
      .from('posts')
      .select(columns, { count: 'exact' })
      .retry(false)
      .eq('status', 'published')
      .is('deleted_at', null)
      .or(`visible_from.is.null,visible_from.lte.${now.toISOString()}`);
  }
  async list<K extends ContentKind>(
    kind: K,
    options: ListQuery = {},
  ): Promise<ListResponse<ContentMap[K]>> {
    const { page = 1, limit = 12, category, q } = options;
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 100000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (q?.length ?? 0) > 200 ||
      (category?.length ?? 0) > 100
    )
      throw new ContentError('invalid-data', 400);
    const now = await this.databaseTime();
    let query = this.query(now);
    if (kind === 'information') {
      query = query.in(
        'kind',
        category === 'Thông báo'
          ? ['information']
          : category === 'Hoạt động'
            ? ['event']
            : ['information', 'event'],
      );
      if (category && !['Thông báo', 'Hoạt động'].includes(category))
        query = query.eq('category', category);
    } else {
      query = query.eq('kind', kind === 'events' ? 'event' : 'scholarship');
      if (category)
        query =
          kind === 'events'
            ? query.or(
                `event_name.eq.${literal(category)},and(event_name.is.null,category.eq.${literal(category)})`,
              )
            : query.eq('category', category);
    }
    if (q?.trim())
      query = query.or(
        `title.ilike.${pattern(q.trim())},summary.ilike.${pattern(q.trim())}`,
      );
    const result = await query
      .order('published_on', { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);
    if (result.error) this.fail(result.error);
    if (!Array.isArray(result.data) || result.count === null)
      throw new ContentError('invalid-data');
    const data = (result.data as unknown as PostRow[]).map((row) => {
      const post = mapPost(row, this.db, now, this.mediaPrefix);
      return {
        ...post,
        category:
          kind === 'information'
            ? row.kind === 'event'
              ? 'Hoạt động'
              : 'Thông báo'
            : post.category,
      } as ContentMap[K];
    });
    return {
      data,
      meta: { total: result.count ?? 0, page, limit, source: 'supabase' },
    };
  }
  async getEventCategories(): Promise<string[]> {
    // Facets read only two small metadata fields, never article bodies/media.
    // Range each request to avoid silently truncating at the PostgREST row cap.
    const now = await this.databaseTime();
    const categories = new Set<string>();
    const batchSize = 500;
    for (let offset = 0; ;) {
      const result = await this.query(now, 'event_name,category')
        .eq('kind', 'event')
        .order('id', { ascending: true })
        .range(offset, offset + batchSize - 1);
      if (result.error) this.fail(result.error);
      if (!Array.isArray(result.data) || result.count === null)
        throw new ContentError('invalid-data');
      for (const row of result.data as unknown as {
        event_name: string | null;
        category: string;
      }[]) {
        const name = row.event_name ?? row.category;
        if (name) categories.add(name);
      }
      if (offset + result.data.length >= (result.count ?? 0)) break;
      if (!result.data.length) throw new ContentError('invalid-data');
      offset += result.data.length;
    }
    return [...categories].sort((a, b) => a.localeCompare(b, 'vi'));
  }
  async getPostBySlug(slug: string): Promise<PublicPost | null> {
    const now = await this.databaseTime();
    const result = await this.query(now).eq('slug', slug).maybeSingle();
    if (result.error) this.fail(result.error);
    return result.data
      ? mapPost(
          result.data as unknown as PostRow,
          this.db,
          now,
          this.mediaPrefix,
        )
      : null;
  }
  // Anonymous client only. Recheck visibility before every byte response; never
  // issue signed URLs, expose private object paths or inherit upstream caching.
  async readPublicMedia(postId: string, mediaId: string): Promise<Blob | null> {
    if (!uuid.test(postId) || !uuid.test(mediaId)) return null;
    const now = await this.databaseTime();
    const result = await this.query(now).eq('id', postId).maybeSingle();
    if (result.error) this.fail(result.error);
    const row = result.data as unknown as PostRow | null;
    if (!row || deriveLifecycle(row, now) !== 'published') return null;
    const media = row.post_media.find((m) => m.id === mediaId);
    if (
      !media ||
      media.bucket !== 'draft-media' ||
      !safeMediaPath(media.storage_path)
    )
      return null;
    const download = await this.db.storage
      .from('draft-media')
      .download(
        media.storage_path,
        { cacheNonce: crypto.randomUUID() },
        { cache: 'no-store' },
      );
    if (download.error || !download.data) return null;
    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(
        download.data.type.split(';')[0],
      ) ||
      download.data.size > 3 * 1024 * 1024
    )
      return null;
    return download.data;
  }
  async getLatestPosts(limit = 3, kind: ContentKind = 'information') {
    return (await this.list(kind, { limit })).data;
  }
  async listPosts(options: ListQuery & { kind?: ContentKind } = {}) {
    return this.list(options.kind ?? 'information', options);
  }
  private fail(error: { message: string; code?: string }): never {
    const code = /quá thời gian|TimeoutError|AbortError/.test(error.message)
      ? 'timeout'
      : 'query';
    console.error(
      JSON.stringify({
        event: 'content_read_failed',
        code,
        databaseCode: /^[A-Z0-9]{5}$/.test(error.code ?? '')
          ? error.code
          : undefined,
      }),
    );
    throw new ContentError(code);
  }
}
