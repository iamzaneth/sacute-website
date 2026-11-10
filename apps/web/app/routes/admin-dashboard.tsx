import { lifecycleLabels } from '@sacute/shared';
import { Link, useLoaderData } from 'react-router';
import { AdminContentRepository } from '../services/admin-content.server';
import {
  requireAdmin,
  adminRead,
  adminHeaders,
} from '../services/admin-auth.server';
import type { Route } from './+types/admin-dashboard';
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
      <h1>Tổng quan nội dung</h1>
      <p>Quản lý bài viết, bản nháp và ảnh của SACUTE.</p>
      <div className="admin-stats">
        {Object.entries(lifecycleLabels).map(([status, label]) => (
          <Link
            className="admin-card"
            key={status}
            to={`/admin/posts?status=${status}`}
          >
            <strong>{counts[status]}</strong>
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <div className="admin-actions">
        {writesEnabled ? (
          <Link className="button button-primary" to="/admin/posts/new">
            Tạo bài viết
          </Link>
        ) : (
          <button disabled>Tạo bài viết</button>
        )}
        <Link className="button button-secondary" to="/admin/posts">
          Quản lý bài viết
        </Link>
        <Link className="button button-secondary" to="/admin/media">
          Quản lý ảnh
        </Link>
      </div>
    </>
  );
}
