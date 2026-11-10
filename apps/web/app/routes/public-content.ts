import { loadPublicResult } from '../services/public-content.server';
import type { PublicView } from '../features/content/public-data';
import type { Route } from './+types/public-content';

export async function loader({ request }: Route.LoaderArgs) {
  const view = new URL(request.url).searchParams.get('view');
  if (
    !view ||
    !['home', 'information', 'scholarships', 'events', 'post'].includes(view)
  )
    return new Response('Bộ lọc không hợp lệ.', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  const result = await loadPublicResult(view as PublicView, request);
  if (!result.ok)
    return new Response(result.message, {
      status: result.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  const headers = {
    'Cache-Control': 'private, no-cache, max-age=0, must-revalidate',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ETag: result.etag,
    Vary: 'Accept-Encoding',
  };
  // Validation happens after a fresh anonymous/RLS read, including DB time.
  if (request.headers.get('If-None-Match') === result.etag)
    return new Response(null, { status: 304, headers });
  return Response.json(result.value, { headers });
}
