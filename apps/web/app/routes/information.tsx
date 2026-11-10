import { ContentList } from '../features/content/content-list';
import {
  readContent,
  listQuery,
  contentHeaders,
} from '../services/content-provider.server';
export const headers = contentHeaders;
import { pageMeta } from '../lib/seo';
import type { Route } from './+types/information';
export const meta = () =>
  pageMeta(
    'Thông tin sinh viên',
    'Theo dõi thông báo và những cập nhật dành cho sinh viên từ SACUTE. Nội dung chính thức đang được cập nhật.',
    '/information',
    true,
  );
export async function loader({ request }: Route.LoaderArgs) {
  return readContent((repository) =>
    repository.list('information', listQuery(request, 'information')),
  );
}
export default function Information({ loaderData }: Route.ComponentProps) {
  return (
    <ContentList
      kind="information"
      items={loaderData.data}
      meta={loaderData.meta}
    />
  );
}
