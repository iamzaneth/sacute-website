import { pageMeta } from '~/lib/seo';
import { ContentList } from '~/features/content/components/content-list';
import { contentHeaders } from '~/services/content/provider.server';
import { streamPublicPage } from '~/services/content/public-content.server';
import { fetchPublicContent } from '~/services/content/public-cache';
import { publicResource } from '~/features/content/data/public-data';
import { useLocation } from 'react-router';
export const headers = contentHeaders;
import type { Route } from './+types/events';
export const meta = () =>
  pageMeta(
    'Sự kiện nổi bật',
    'Theo dõi bài viết, hình ảnh và hoạt động từ Xuân tình nguyện, Chuyến xe đoàn viên cùng các sự kiện nổi bật của SACUTE.',
    '/events',
    true,
  );
export function loader({ request }: Route.LoaderArgs) {
  return streamPublicPage('events', request);
}
export function clientLoader({ request }: Route.ClientLoaderArgs) {
  return { content: fetchPublicContent('events', request.url) };
}
export default function Events({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  const cacheKey = publicResource(
    'events',
    location.pathname + location.search,
  );
  return (
    <ContentList
      kind="events"
      content={loaderData.content}
      cacheKey={cacheKey}
    />
  );
}
