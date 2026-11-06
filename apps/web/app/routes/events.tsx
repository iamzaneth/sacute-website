import { ContentList } from '../features/content/content-list';
import { contentProvider } from '../services/content-provider';
import { pageMeta } from '../lib/seo';
import type { Route } from './+types/events';
export const meta = () =>
  pageMeta(
    'Sự kiện nổi bật',
    'Theo dõi bài viết, hình ảnh và hoạt động từ Xuân tình nguyện, Chuyến xe đoàn viên cùng các sự kiện nổi bật của SACUTE.',
    '/events',
  );
export async function loader() {
  return contentProvider.list('events');
}
export default function Events({ loaderData }: Route.ComponentProps) {
  return <ContentList kind="events" items={loaderData.data} />;
}
