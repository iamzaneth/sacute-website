import { HomePage } from '../features/home/home-page';
import { pageMeta } from '../lib/seo';
export const meta = () =>
  pageMeta(
    'Trang chủ',
    'SACUTE — Không gian thông tin, học bổng, hoạt động và kết nối với Trung tâm Tư vấn và Hỗ trợ Sinh viên.',
    '/',
  );
export default HomePage;
