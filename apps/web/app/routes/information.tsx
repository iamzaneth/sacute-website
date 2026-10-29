import { ContentList } from '../features/content/content-list';
import { contentProvider } from '../services/content-provider';
import { pageMeta } from '../lib/seo';
import type { Route } from './+types/information';
export const meta = () =>
  pageMeta(
    'Thông tin sinh viên',
    'Theo dõi thông báo và những cập nhật dành cho sinh viên từ SACUTE. Nội dung chính thức đang được cập nhật.',
    '/information',
  );
export async function loader() {
  return contentProvider.list('information');
}
export default function Information({ loaderData }: Route.ComponentProps) {
  return <ContentList kind="information" items={loaderData.data} />;
}
