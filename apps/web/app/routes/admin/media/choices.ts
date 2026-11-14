import { data } from 'react-router';
import { requireAdminRead } from '~/services/admin/auth.server';
import { AdminContentRepository } from '~/services/admin/content.server';
import type { Route } from './+types/choices';
export async function loader({ request }: Route.LoaderArgs) {
  const context = await requireAdminRead(request);
  const params = new URL(request.url).searchParams;
  const prefix = params.get('prefix') ?? 'admin';
  const bucket = params.get('bucket') ?? 'draft-media';
  const page = Number(params.get('page') ?? 1);
  try {
    const result = await new AdminContentRepository(context.db).media(
      prefix,
      page,
      bucket,
    );
    return data({ ...result, error: '' }, { headers: context.headers });
  } catch {
    // Optional picker errors must not unmount an editor with unsaved text.
    return data(
      {
        objects: [],
        prefix,
        bucket,
        page,
        hasMore: false,
        error: 'Không thể tải thư viện ảnh. Vui lòng thử lại.',
      },
      { headers: context.headers },
    );
  }
}
