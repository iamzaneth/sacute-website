import { pageMeta } from '~/lib/seo';
import { ContentList } from '~/features/content/components/content-list';
import { contentHeaders } from '~/services/content/provider.server';
import { streamPublicPage } from '~/services/content/public-content.server';
import { fetchPublicContent } from '~/services/content/public-cache';
import { publicResource } from '~/features/content/data/public-data';
import { useLocation } from 'react-router';
export const headers = contentHeaders;
import type { Route } from './+types/information';
export const meta = () =>
  pageMeta(
    'Thông tin sinh viên',
    'Theo dõi thông báo và những cập nhật dành cho sinh viên từ SACUTE. Nội dung chính thức đang được cập nhật.',
    '/information',
    true,
  );
export function loader({ request }: Route.LoaderArgs) {
  return streamPublicPage('information', request);
}
export function clientLoader({ request }: Route.ClientLoaderArgs) {
  return { content: fetchPublicContent('information', request.url) };
}
export default function Information({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  const cacheKey = publicResource(
    'information',
    location.pathname + location.search,
  );
  return (
    <ContentList
      kind="information"
      content={loaderData.content}
      cacheKey={cacheKey}
    />
  );
}
