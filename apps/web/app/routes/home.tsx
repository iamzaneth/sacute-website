import { HomePage } from '../features/home/home-page';
import { pageMeta } from '../lib/seo';
export const meta = () =>
  pageMeta(
    'Trang chủ',
    'SACUTE — Không gian thông tin, học bổng, hoạt động và kết nối với Trung tâm Tư vấn và Hỗ trợ Sinh viên.',
    '/',
    true,
  );
import {
  readContent,
  contentHeaders,
} from '../services/content-provider.server';
import type { Route } from './+types/home';
export const headers = contentHeaders;
export async function loader() {
  return readContent(async (repository) => {
    const [information, scholarships, events] = await Promise.all([
      repository.list('information', { category: 'Thông báo', limit: 1 }),
      repository.list('scholarships', { limit: 1 }),
      repository.list('events', { limit: 2 }),
    ]);
    return {
      information: information.data,
      scholarships: scholarships.data,
      events: events.data,
    };
  });
}
export default function Home({ loaderData }: Route.ComponentProps) {
  return <HomePage content={loaderData} />;
}
