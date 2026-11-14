import {
  createVersionedCache,
  type ContentVersion,
} from '~/services/cache/versioned.server';
import { createHash } from 'node:crypto';
import { isbot } from 'isbot';
import { data } from 'react-router';
import {
  ContentError,
  queryRPCEnabled,
  SupabaseContentRepository,
} from '@sacute/shared/content';
import { contentProvider, publicDatabase, listQuery } from './provider.server';
import type {
  PublicPayloads,
  PublicView,
  PublicResult,
} from '~/features/content/data/public-data';

const readPublicSnapshot = createVersionedCache();
// The enclosing representation read verifies this revision before/after loading.
// Facets are independent of q/page/category and can share that verified version.
const facets = new Map<string, Promise<string[]>>();
function eventCategories(
  repository: SupabaseContentRepository,
  version?: ContentVersion,
) {
  if (!version) return repository.getEventCategories();
  const cached = facets.get(version.revision);
  if (cached) return cached;
  const job = repository.getEventCategories();
  facets.set(version.revision, job);
  while (facets.size > 4) facets.delete(facets.keys().next().value!);
  void job.catch(() => {
    if (facets.get(version.revision) === job) facets.delete(version.revision);
  });
  return job;
}

const readers = {
  home: async (repository: SupabaseContentRepository) => {
    const [information, scholarships, events] = await Promise.all([
      repository.list(
        'information',
        { category: 'Thông báo', limit: 1 },
        false,
      ),
      repository.list('scholarships', { limit: 1 }, false),
      repository.list('events', { limit: 2 }, false),
    ]);
    return {
      information: information.data,
      scholarships: scholarships.data,
      events: events.data,
    };
  },
  information: (repository: SupabaseContentRepository, request: Request) =>
    repository.list('information', listQuery(request, 'information')),
  scholarships: (repository: SupabaseContentRepository, request: Request) =>
    repository.list('scholarships', listQuery(request, 'scholarships')),
  events: async (
    repository: SupabaseContentRepository,
    request: Request,
    version?: ContentVersion,
  ) => {
    const [result, categories] = await Promise.all([
      repository.list('events', listQuery(request, 'events')),
      eventCategories(repository, version),
    ]);
    return { ...result, categories };
  },
  post: async (repository: SupabaseContentRepository, request: Request) => {
    const slug = new URL(request.url).searchParams.get('slug') ?? '';
    if (!slug || slug.length > 180)
      throw new Response('Không tìm thấy bài viết', { status: 404 });
    const item = await repository.getPostBySlug(slug);
    if (!item) throw new Response('Không tìm thấy bài viết', { status: 404 });
    return { item };
  },
};

export async function loadPublicResult<K extends PublicView>(
  view: K,
  request: Request,
): Promise<PublicResult<PublicPayloads[K]>> {
  try {
    const read = async (version?: ContentVersion) => {
      let clock: Promise<Date> | undefined;
      const repository = new SupabaseContentRepository(publicDatabase(), () =>
        version
          ? new Date(version.now)
          : (clock ??= contentProvider().databaseTime()),
      );
      const value = (await readers[view](
        repository,
        request,
        version,
      )) as PublicPayloads[K];
      const etag = `W/"${createHash('sha256').update(JSON.stringify(value)).digest('hex')}"`;
      return { ok: true as const, value, etag };
    };
    if (!queryRPCEnabled()) return await read();
    const params = new URL(request.url).searchParams;
    const key = JSON.stringify([
      view,
      view === 'post'
        ? params.get('slug')
        : listQuery(request, view === 'home' ? 'information' : view),
    ]);
    return await readPublicSnapshot(
      key,
      async () => {
        const result = await publicDatabase().rpc('sacute_public_revision');
        if (
          result.error ||
          typeof result.data?.revision !== 'string' ||
          !Number.isFinite(Date.parse(result.data?.now))
        )
          throw new ContentError('query');
        return result.data as ContentVersion;
      },
      read,
    );
  } catch (error) {
    const status =
      error instanceof Response
        ? error.status
        : error instanceof ContentError
          ? error.status
          : 503;
    const message =
      status === 404
        ? 'Không tìm thấy bài viết.'
        : status === 400
          ? 'Bộ lọc không hợp lệ.'
          : 'Không thể tải nội dung. Vui lòng thử lại sau.';
    console.error(
      JSON.stringify({
        event: 'public_content_failed',
        status,
        code: error instanceof ContentError ? error.code : undefined,
      }),
    );
    return { ok: false, message, status };
  }
}

export async function streamPublicPage<K extends Exclude<PublicView, 'post'>>(
  view: K,
  request: Request,
) {
  const content = loadPublicResult(view, request);
  // Crawlers and non-document clients retain complete SSR/error status semantics.
  // Human document requests can receive static HTML before the database finishes.
  if (
    !request.headers.get('Accept')?.includes('text/html') ||
    isbot(request.headers.get('User-Agent') ?? '')
  ) {
    const result = await content;
    if (!result.ok)
      throw new Response(result.message, {
        status: result.status,
        headers: { 'Cache-Control': 'no-store' },
      });
    return data(
      { content: result },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return data({ content }, { headers: { 'Cache-Control': 'no-store' } });
}
