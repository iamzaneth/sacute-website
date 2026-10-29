import { ContentList } from '../features/content/content-list';
import { contentProvider } from '../services/content-provider';
import { pageMeta } from '../lib/seo';
import type { Route } from './+types/events';
export const meta = () =>
  pageMeta(
    'Sự kiện nổi bật',
    'Khám phá thông tin hoạt động sinh viên và sự kiện SACUTE. Lịch trình sẽ hiển thị sau khi có xác nhận chính thức.',
    '/events',
  );
export async function loader() {
  return contentProvider.list('events');
}
export default function Events({ loaderData }: Route.ComponentProps) {
  return <ContentList kind="events" items={loaderData.data} />;
}
