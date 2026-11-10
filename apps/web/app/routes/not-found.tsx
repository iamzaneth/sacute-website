import { data } from 'react-router';
export const loader = () =>
  data(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
import { ActionLink } from '../components/ui';
import { pageMeta } from '../lib/seo';
export const meta = () =>
  pageMeta(
    'Không tìm thấy trang',
    'Trang bạn đang tìm không tồn tại. Quay lại trang chủ SACUTE để tiếp tục tìm kiếm thông tin.',
    '/404',
  );
export default function NotFound() {
  return (
    <div className="page not-found">
      <span className="error-number">
        404<span>.</span>
      </span>
      <p className="eyebrow">CÓ LẼ BẠN ĐÃ RẼ NHẦM ĐƯỜNG</p>
      <h1>Trang này chưa có ở đây.</h1>
      <p>
        Đường dẫn có thể đã thay đổi hoặc không tồn tại.
        <br />
        Cùng quay lại để tìm thông tin bạn cần.
      </p>
      <ActionLink to="/">Về trang chủ</ActionLink>
    </div>
  );
}
