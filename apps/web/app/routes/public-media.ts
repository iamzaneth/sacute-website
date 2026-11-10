import { ContentError, publicMediaHeaders } from '@sacute/shared/content';
import { contentProvider } from '../services/content-provider.server';
import type { Route } from './+types/public-media';

export async function loader({ params }: Route.LoaderArgs) {
  try {
    const blob = await contentProvider().readPublicMedia(
      params.id,
      params.mediaId,
    );
    if (!blob)
      return new Response(null, { status: 404, headers: publicMediaHeaders });
    return new Response(blob, {
      headers: { ...publicMediaHeaders, 'Content-Type': blob.type },
    });
  } catch (error) {
    return new Response(null, {
      status: error instanceof ContentError ? error.status : 503,
      headers: publicMediaHeaders,
    });
  }
}
