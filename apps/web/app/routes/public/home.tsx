import { HomePage } from '~/features/home/home-page';
import { pageMeta } from '~/lib/seo';
export const meta = () =>
  pageMeta(
    'Trang chủ',
    'SACUTE — Không gian thông tin, học bổng, hoạt động và kết nối với Trung tâm Tư vấn và Hỗ trợ Sinh viên.',
    '/',
    true,
  );
import { contentHeaders } from '~/services/content/provider.server';
import { streamPublicPage } from '~/services/content/public-content.server';
import { fetchPublicContent } from '~/services/content/public-cache';
import { publicResource } from '~/features/content/data/public-data';
import { useLocation } from 'react-router';
export const headers = contentHeaders;
import type { Route } from './+types/home';
export function loader({ request }: Route.LoaderArgs) {
  return streamPublicPage('home', request);
}
export function clientLoader({ request }: Route.ClientLoaderArgs) {
  return { content: fetchPublicContent('home', request.url) };
}
export default function Home({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  const cacheKey = publicResource('home', location.pathname + location.search);
  return <HomePage content={loaderData.content} cacheKey={cacheKey} />;
}
