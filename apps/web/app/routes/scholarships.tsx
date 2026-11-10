import { pageMeta } from '../lib/seo';
import { ContentList } from '../features/content/content-list';
import { contentHeaders } from '../services/content-provider.server';
import { streamPublicPage } from '../services/public-content.server';
import { fetchPublicContent } from '../services/public-content-cache';
import { publicResource } from '../features/content/public-data';
import { useLocation } from 'react-router';
export const headers = contentHeaders;
import type { Route } from './+types/scholarships';
export const meta = () =>
  pageMeta(
    'Học bổng',
    'Cập nhật thông tin học bổng và cơ hội hỗ trợ học tập tại SACUTE khi có thông báo được xác nhận.',
    '/scholarships',
    true,
  );
export function loader({ request }: Route.LoaderArgs) {
  return streamPublicPage('scholarships', request);
}
export function clientLoader({ request }: Route.ClientLoaderArgs) {
  return { content: fetchPublicContent('scholarships', request.url) };
}
export default function Scholarships({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  const cacheKey = publicResource(
    'scholarships',
    location.pathname + location.search,
  );
  return (
    <ContentList
      kind="scholarships"
      content={loaderData.content}
      cacheKey={cacheKey}
    />
  );
}
