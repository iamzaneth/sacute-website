import {
  ArrowUpRight,
  Plus,
  FilePenLine,
  CalendarDays,
  Images,
  Files,
} from 'lucide-react';
import { lifecycleLabels } from '@sacute/shared';
import { Link, useLoaderData } from 'react-router';
import { AdminContentRepository } from '~/services/admin/content.server';
import {
  requireAdmin,
  adminRead,
  adminHeaders,
} from '~/services/admin/auth.server';
import type { Route } from './+types/dashboard';
export const headers = adminHeaders;
export async function loader({
  request,
  context: requestContext,
}: Route.LoaderArgs) {
  const context = await requireAdmin(request, requestContext);
  return adminRead(context, async () => ({
    counts: await new AdminContentRepository(context.db).counts(),
    writesEnabled: context.writesEnabled,
  }));
}
export default function AdminDashboard() {
  const { counts, writesEnabled } = useLoaderData<typeof loader>();
  return (
    <>
      <div className="admin-title">
        <div>
          <p className="admin-eyebrow">KHÔNG GIAN LÀM VIỆC</p>
          <h1>Tổng quan nội dung</h1>
          <p className="admin-description">
            Chào bạn, hôm nay SACUTE có gì mới?
          </p>
        </div>
        {writesEnabled ? (
          <Link className="button button-primary" to="/admin/posts/new">
            <Plus size={18} />
            Tạo bài viết
          </Link>
        ) : (
          <button disabled>
            <Plus size={18} />
            Tạo bài viết
          </button>
        )}
      </div>
      <section className="admin-welcome admin-card">
        <div>
          <span className="admin-section-icon">
            <Files size={24} />
          </span>
          <h2>Mọi nội dung, một nơi quản lý</h2>
          <p>
            Theo dõi bài đã đăng, hoàn thiện bản nháp và chuẩn bị những nội dung
            tiếp theo cho sinh viên.
          </p>
          <Link to="/admin/posts">
            Mở danh sách bài viết <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="admin-welcome-summary">
          <strong>
            {Object.entries(counts)
              .filter(([status]) => status !== 'trashed')
              .reduce((total, [, count]) => total + count, 0)}
          </strong>
          <span>bài viết trong không gian nội dung</span>
        </div>
      </section>
      <div className="admin-section-heading">
        <h2>Trạng thái nội dung</h2>
        <span>Chọn để xem danh sách</span>
      </div>
      <div className="admin-stats">
        {Object.entries(lifecycleLabels).map(([status, label]) => (
          <Link
            className="admin-card"
            key={status}
            to={`/admin/posts?status=${status}`}
          >
            <strong>{counts[status]}</strong>
            <span>
              {label} <ArrowUpRight size={16} />
            </span>
          </Link>
        ))}
      </div>
      <div className="admin-section-heading">
        <h2>Công việc tiếp theo</h2>
      </div>
      <div className="admin-quick-grid">
        <Link
          className="admin-card admin-quick-card"
          to="/admin/posts?status=draft"
        >
          <FilePenLine size={22} />
          <div>
            <h3>Hoàn thiện bản nháp</h3>
            <p>Tiếp tục biên tập các bài chưa công bố.</p>
          </div>
          <ChevronIcon />
        </Link>
        <Link
          className="admin-card admin-quick-card"
          to="/admin/posts?status=scheduled"
        >
          <CalendarDays size={22} />
          <div>
            <h3>Kiểm tra lịch đăng</h3>
            <p>Xem những bài đang chờ đến giờ công bố.</p>
          </div>
          <ChevronIcon />
        </Link>
        <Link className="admin-card admin-quick-card" to="/admin/media">
          <Images size={22} />
          <div>
            <h3>Chuẩn bị hình ảnh</h3>
            <p>Quản lý ảnh và đính kèm vào bài viết.</p>
          </div>
          <ChevronIcon />
        </Link>
      </div>
    </>
  );
}

function ChevronIcon() {
  return <ArrowUpRight size={18} aria-hidden="true" />;
}
