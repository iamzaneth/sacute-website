import { ContentList } from '../features/content/content-list';
import { contentProvider } from '../services/content-provider';
import { pageMeta } from '../lib/seo';
import type { Route } from './+types/scholarships';
export const meta = () =>
  pageMeta(
    'Học bổng',
    'Cập nhật thông tin học bổng và cơ hội hỗ trợ học tập tại SACUTE khi có thông báo được xác nhận.',
    '/scholarships',
  );
export async function loader() {
  return contentProvider.list('scholarships');
}
export default function Scholarships({ loaderData }: Route.ComponentProps) {
  return <ContentList kind="scholarships" items={loaderData.data} />;
}
