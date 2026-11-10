import { lifecycleLabels, formatSchedule } from '@sacute/shared';
import { LifecycleControls } from '../features/admin/lifecycle-controls';
import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useActionData,
  useSearchParams,
} from 'react-router';
import {
  AdminContentRepository,
  lifecycleAction,
} from '../services/admin-content.server';
import {
  requireAdmin,
  adminRead,
  adminHeaders,
} from '../services/admin-auth.server';
import type { Route } from './+types/admin-posts';
export const headers = adminHeaders;
export async function loader({
  request,
  context: requestContext,
}: Route.LoaderArgs) {
  const context = await requireAdmin(request, requestContext);
  return adminRead(context, async () => ({
    ...(await new AdminContentRepository(context.db).list(request)),
    writesEnabled: context.writesEnabled,
  }));
}
export const action = ({ request, context }: Route.ActionArgs) =>
  lifecycleAction(request, context);
export const kindLabels: Record<string, string> = {
  information: 'Thông tin',
  scholarship: 'Học bổng',
  event: 'Sự kiện',
};
export const statusLabels = { ...lifecycleLabels, trashed: 'Thùng rác' };
export default function AdminPosts() {
  const state = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const result = useActionData<typeof action>();
  const [params] = useSearchParams();
  const pageURL = (page: number) =>
    `/admin/posts?${new URLSearchParams({ q: state.q, kind: state.kind, status: state.status, page: String(page) })}`;
  return (
    <>
      <div className="admin-title">
        <h1>Bài viết</h1>
        {state.writesEnabled ? (
          <Link className="button button-primary" to="/admin/posts/new">
            Tạo bài viết
          </Link>
        ) : (
          <button disabled>Tạo bài viết</button>
        )}
      </div>
      {result?.errors && (
        <p role="alert" className="admin-errors">
          {Object.values(result.errors).join(' ')}
        </p>
      )}
      {params.has('saved') && navigation.state === 'idle' && (
        <p role="status" className="admin-success">
          Đã cập nhật trạng thái bài viết.
        </p>
      )}
      <Form method="get" className="admin-filters">
        <label>
          Tìm tiêu đề
          <input
            name="q"
            defaultValue={state.q}
            maxLength={200}
            type="search"
          />
        </label>
        <label>
          Loại bài
          <select name="kind" defaultValue={state.kind}>
            <option value="">Tất cả</option>
            {Object.entries(kindLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trạng thái
          <select name="status" defaultValue={state.status}>
            <option value="">Tất cả</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button disabled={navigation.state !== 'idle'}>Lọc bài viết</button>
      </Form>
      <p role="status">{state.total} bài viết</p>
      {state.posts.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Tiêu đề</th>
                <th scope="col">Loại</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Cập nhật gần nhất</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {state.posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    {post.title}
                    <small>Danh mục: {post.category}</small>
                    <small>/{post.slug}</small>
                  </td>
                  <td>{kindLabels[post.kind]}</td>
                  <td>
                    <span className={`admin-badge ${post.lifecycle}`}>
                      {lifecycleLabels[post.lifecycle]}
                    </span>
                    {post.lifecycle === 'scheduled' && (
                      <small>{formatSchedule(post.visible_from)}</small>
                    )}
                  </td>
                  <td>
                    {post.updated_at
                      ? formatSchedule(post.updated_at)
                      : 'Chưa ghi nhận'}
                  </td>
                  <td>
                    <Link to={`/admin/posts/${post.id}/edit`}>
                      {state.writesEnabled &&
                      !['archived', 'trashed'].includes(post.lifecycle)
                        ? 'Chỉnh sửa'
                        : 'Xem'}
                    </Link>
                    <LifecycleControls
                      key={`${post.id}/${post.lifecycle_revision}/${post.lifecycle}`}
                      post={post}
                      state={post.lifecycle}
                      now={state.now}
                      disabled={
                        !state.writesEnabled || navigation.state !== 'idle'
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-card">
          Không có bài viết phù hợp. Thử thay đổi bộ lọc.
        </p>
      )}
      <nav className="admin-pagination" aria-label="Phân trang bài viết">
        {state.page > 1 && (
          <Link to={pageURL(state.page - 1)}>Trang trước</Link>
        )}
        <span>Trang {state.page}</span>
        {state.page * 20 < state.total && (
          <Link to={pageURL(state.page + 1)}>Trang sau</Link>
        )}
      </nav>
    </>
  );
}
