import { ContentList } from '../features/content/content-list';
import {
  readContent,
  listQuery,
  contentHeaders,
} from '../services/content-provider.server';
export const headers = contentHeaders;
import { pageMeta } from '../lib/seo';
import type { Route } from './+types/events';
export const meta = () =>
  pageMeta(
    'Sự kiện nổi bật',
    'Theo dõi bài viết, hình ảnh và hoạt động từ Xuân tình nguyện, Chuyến xe đoàn viên cùng các sự kiện nổi bật của SACUTE.',
    '/events',
    true,
  );
export async function loader({ request }: Route.LoaderArgs) {
  return readContent(async (repository) => {
    const [result, categories] = await Promise.all([
      repository.list('events', listQuery(request, 'events')),
      repository.getEventCategories(),
    ]);
    return { ...result, categories };
  });
}

export default function Events({ loaderData }: Route.ComponentProps) {
  return (
    <ContentList
      kind="events"
      items={loaderData.data}
      meta={loaderData.meta}
      categoryOptions={loaderData.categories}
    />
  );
}
