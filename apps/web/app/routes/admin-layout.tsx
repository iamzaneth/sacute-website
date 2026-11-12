import {
  Form,
  NavLink,
  Outlet,
  useLoaderData,
  useNavigation,
  useLocation,
  useRouteError,
  isRouteErrorResponse,
  Link,
} from 'react-router';
import {
  requireAdmin,
  assertSameOrigin,
  adminHeaders,
  adminRead,
} from '../services/admin-auth.server';
import type { Route } from './+types/admin-layout';
import '../styles/admin.css';
import { ContentSkeleton } from '../features/content/content-skeleton';
import { useToastFeedback } from '../components/toast/toast';
export const headers = adminHeaders;
export const meta = () => [
  { title: 'Quản trị | SACUTE' },
  { name: 'robots', content: 'noindex, nofollow' },
];
export async function loader({
  request,
  context: requestContext,
}: Route.LoaderArgs) {
  const context = await requireAdmin(request, requestContext);
  return adminRead(context, async () => ({
    email: context.user.email,
    writesEnabled: context.writesEnabled,
  }));
}
export async function action({
  request,
  context: requestContext,
}: Route.ActionArgs) {
  assertSameOrigin(request);
  const context = await requireAdmin(request, requestContext);
  const result = await context.db.auth.signOut({ scope: 'local' });
  if (result.error)
    throw new Response('Không thể đăng xuất. Vui lòng thử lại.', {
      status: 503,
      headers: context.headers,
    });
  const { redirect } = await import('react-router');
  return redirect('/admin/login?logout=1', {
    status: 303,
    headers: context.headers,
  });
}
export default function AdminLayout() {
  const { email, writesEnabled } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const location = useLocation();
  const changingPage =
    navigation.state === 'loading' &&
    !navigation.formMethod &&
    Boolean(
      navigation.location && navigation.location.pathname !== location.pathname,
    );
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link to="/admin" className="admin-brand">
          SACUTE <span>Quản trị nội dung</span>
        </Link>
        <span>{email}</span>
        <Form method="post" action="/admin">
          <button type="submit" disabled={navigation.state !== 'idle'}>
            Đăng xuất
          </button>
        </Form>
      </header>
      <nav className="admin-nav" aria-label="Quản trị">
        <NavLink to="/admin" end>
          Tổng quan
        </NavLink>
        <NavLink to="/admin/posts">Bài viết</NavLink>
        <NavLink to="/admin/media">Thư viện ảnh</NavLink>
      </nav>
      <main id="main-content" className="admin-main" tabIndex={-1}>
        {!writesEnabled && (
          <p className="admin-notice" role="status">
            <strong>Chế độ chỉ đọc.</strong> Chưa cho phép ghi nội dung. Cần
            hoàn tất kiểm tra RLS và áp dụng migration trước khi bật quyền ghi.
          </p>
        )}
        {changingPage && <ContentSkeleton label="Đang tải dữ liệu quản trị…" />}
        <div hidden={changingPage}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 503;
  useToastFeedback(
    error,
    isRouteErrorResponse(error) && typeof error.data === 'string'
      ? error.data
      : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.',
    'error',
  );
  return (
    <main id="main-content" className="admin-main admin-error">
      <p className="eyebrow">SACUTE · Quản trị</p>
      <h1>
        {status === 403
          ? 'Không có quyền truy cập'
          : status === 404
            ? 'Không tìm thấy nội dung'
            : 'Không thể hoàn tất yêu cầu'}
      </h1>
      <p role="alert">
        {isRouteErrorResponse(error) && typeof error.data === 'string'
          ? error.data
          : 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại.'}
      </p>
      <Link to="/admin/login">Đăng nhập lại</Link>
      <Link to="/admin">Về tổng quan</Link>
    </main>
  );
}
