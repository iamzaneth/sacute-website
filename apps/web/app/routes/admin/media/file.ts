import { ImageWorkBusyError } from '~/services/media/work.server';
import { imageVariant, imageWidth } from '~/services/media/variants.server';
import { requireAdminRead, privateHeaders } from '~/services/admin/auth.server';
import {
  mediaBuckets,
  validStoragePath,
  type MediaBucket,
} from '~/features/admin/model';
import type { Route } from './+types/file';
// Resource route: no signed or public URL is minted for private media.
export async function loader({ request }: Route.LoaderArgs) {
  const context = await requireAdminRead(request);
  let width;
  try {
    width = imageWidth(request);
  } catch {
    throw new Response('Kích thước ảnh không hợp lệ.', {
      status: 400,
      headers: context.headers,
    });
  }
  const params = new URL(request.url).searchParams;
  const bucket = params.get('bucket') ?? '';
  const path = params.get('path') ?? '';
  if (!mediaBuckets.includes(bucket as MediaBucket) || !validStoragePath(path))
    throw new Response('Đường dẫn ảnh không hợp lệ.', {
      status: 400,
      headers: context.headers,
    });
  const result = await context.db.storage.from(bucket).download(path);
  if (result.error || !result.data)
    throw new Response('Không tìm thấy ảnh.', {
      status: 404,
      headers: context.headers,
    });
  const mime = result.data.type.split(';')[0];
  if (
    !['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(mime) ||
    result.data.size > 10 * 1024 * 1024
  )
    throw new Response('Ảnh không được hỗ trợ.', {
      status: 415,
      headers: context.headers,
    });
  const headers = privateHeaders();
  for (const cookie of context.headers.getSetCookie())
    headers.append('Set-Cookie', cookie);
  let image;
  try {
    image = await imageVariant(result.data, width);
  } catch (error) {
    if (error instanceof ImageWorkBusyError) headers.set('Retry-After', '1');
    throw new Response('Không thể xử lý ảnh.', {
      status: error instanceof ImageWorkBusyError ? 503 : 415,
      headers,
    });
  }
  headers.set('Content-Type', image.type);
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
  headers.set('Content-Disposition', 'inline');
  return new Response(image, { headers });
}
