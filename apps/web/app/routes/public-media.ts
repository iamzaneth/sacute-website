import { ImageWorkBusyError } from '../services/image-work.server';
import {
  imageVariant,
  imageWidth,
  ImageVariantError,
} from '../services/image-variants.server';
import { ContentError, publicMediaHeaders } from '@sacute/shared/content';
import { contentProvider } from '../services/content-provider.server';
import type { Route } from './+types/public-media';

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const width = imageWidth(request);
    const blob = await contentProvider().readPublicMedia(
      params.id,
      params.mediaId,
    );
    if (!blob)
      return new Response(null, { status: 404, headers: publicMediaHeaders });
    const image = await imageVariant(blob, width);
    return new Response(image, {
      headers: { ...publicMediaHeaders, 'Content-Type': image.type },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return new Response(null, {
      status:
        error instanceof ContentError
          ? error.status
          : error instanceof ImageVariantError
            ? 415
            : 503,
      headers: {
        ...publicMediaHeaders,
        ...(error instanceof ImageWorkBusyError ? { 'Retry-After': '1' } : {}),
      },
    });
  }
}
