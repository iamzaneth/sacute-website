import {
  createPublicSupabaseClient,
  SupabaseContentRepository,
  ContentError,
} from '@sacute/shared/content';
import { data } from 'react-router';
import type { ContentKind, ListQuery } from '@sacute/shared';
let repository: SupabaseContentRepository | undefined;
let database: ReturnType<typeof createPublicSupabaseClient> | undefined;
export function publicDatabase() {
  return (database ??= createPublicSupabaseClient(process.env));
}
export function contentProvider() {
  return (repository ??= new SupabaseContentRepository(publicDatabase()));
}
export async function readContent<T>(
  read: (repository: SupabaseContentRepository) => Promise<T>,
) {
  try {
    return data(await read(contentProvider()), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof ContentError) {
      console.error(
        JSON.stringify({ event: 'web_content_failed', code: error.code }),
      );
      throw new Response(error.message, {
        status: error.status,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    console.error(
      JSON.stringify({ event: 'web_content_failed', code: 'unexpected' }),
    );
    throw new Response('Không thể tải nội dung. Vui lòng thử lại sau.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
export function listQuery(request: Request, kind: ContentKind): ListQuery {
  const params = new URL(request.url).searchParams;
  return {
    page: Number(params.get('page') ?? 1),
    limit: 12,
    q: params.get('q') ?? undefined,
    category:
      params.get('category') ??
      (kind === 'information' ? 'Thông báo' : undefined),
  };
}
export const contentHeaders = () => ({ 'Cache-Control': 'no-store' });
