import { ContentList } from '../features/content/content-list';
import {
  readContent,
  listQuery,
  contentHeaders,
} from '../services/content-provider.server';
export const headers = contentHeaders;
import { pageMeta } from '../lib/seo';
import type { Route } from './+types/scholarships';
export const meta = () =>
  pageMeta(
    'Học bổng',
    'Cập nhật thông tin học bổng và cơ hội hỗ trợ học tập tại SACUTE khi có thông báo được xác nhận.',
    '/scholarships',
    true,
  );
export async function loader({ request }: Route.LoaderArgs) {
  return readContent((repository) =>
    repository.list('scholarships', listQuery(request, 'scholarships')),
  );
}
export default function Scholarships({ loaderData }: Route.ComponentProps) {
  return (
    <ContentList
      kind="scholarships"
      items={loaderData.data}
      meta={loaderData.meta}
    />
  );
}
