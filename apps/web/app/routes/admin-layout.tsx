import { adminMutation } from '../services/admin-cache.server';
import {
  Form,
  NavLink,
  Outlet,
  useLoaderData,
  useNavigation,
  useRevalidator,
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
import { contentChangedEvent } from '../features/content/content-invalidation';
import { useEffect, useState } from 'react';
import {
  House,
  FileText,
  Images,
  CalendarDays,
  ExternalLink,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { BrandLogo } from '../components/brand';
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
async function handleAction({
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
export const action = (args: Route.ActionArgs) =>
  adminMutation(() => handleAction(args));
export default function AdminLayout() {
  const { email, writesEnabled } = useLoaderData<typeof loader>();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = useNavigation();
  const location = useLocation();
  const revalidator = useRevalidator();
  useEffect(() => {
    // Never replace loader data under a dirty editor with a background refresh.
    if (!['/admin', '/admin/posts', '/admin/media'].includes(location.pathname))
      return;
    const refresh = () => {
      if (
        document.visibilityState === 'visible' &&
        navigation.state === 'idle' &&
        revalidator.state === 'idle'
      )
        void revalidator.revalidate();
    };
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener('focus', refresh);
    window.addEventListener(contentChangedEvent, refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(contentChangedEvent, refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [location.pathname, navigation.state, revalidator]);
  const changingPage =
    navigation.state === 'loading' &&
    !navigation.formMethod &&
    Boolean(
      navigation.location &&
      (navigation.location.pathname !== location.pathname ||
        navigation.location.search !== location.search),
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link
          to="/admin"
          className="admin-brand"
          onClick={() => setMenuOpen(false)}
        >
          <BrandLogo />
          <span>
            <strong>SACUTE</strong>
            <small>Không gian quản trị</small>
          </span>
        </Link>
        <button
          type="button"
          className="admin-menu-toggle"
          aria-label={menuOpen ? 'Đóng điều hướng' : 'Mở điều hướng'}
          aria-expanded={menuOpen}
          aria-controls="admin-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div
          id="admin-navigation"
          className={`admin-sidebar-content${menuOpen ? ' is-open' : ''}`}
        >
          <p className="admin-nav-label">QUẢN LÝ NỘI DUNG</p>
          <nav
            className="admin-nav"
            aria-label="Quản trị"
            onClick={() => setMenuOpen(false)}
          >
            <NavLink to="/admin" end>
              <House size={20} />
              Tổng quan
            </NavLink>
            <NavLink to="/admin/posts">
              <FileText size={20} />
              Bài viết
            </NavLink>
            <NavLink to="/admin/media">
              <Images size={20} />
              Thư viện ảnh
            </NavLink>
          </nav>
          <Link
            className="admin-schedule-link"
            to="/admin/posts?status=scheduled"
            onClick={() => setMenuOpen(false)}
          >
            <CalendarDays size={18} />
            Bài đã lên lịch
            <ChevronRight size={16} />
          </Link>
          <div className="admin-sidebar-bottom">
            <Link to="/" className="admin-visit">
              <ExternalLink size={18} />
              Xem website
            </Link>
            <div className="admin-account">
              <span className="admin-avatar" aria-hidden="true">
                {email?.slice(0, 1).toUpperCase() ?? 'A'}
              </span>
              <span>
                <strong>Quản trị viên</strong>
                <small>{email}</small>
              </span>
            </div>
            <Form method="post" action="/admin">
              <button type="submit" disabled={navigation.state !== 'idle'}>
                <LogOut size={17} />
                Đăng xuất
              </button>
            </Form>
          </div>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <span>
            SACUTE <ChevronRight size={14} />{' '}
            {location.pathname.startsWith('/admin/media')
              ? 'Thư viện ảnh'
              : location.pathname.startsWith('/admin/posts')
                ? 'Bài viết'
                : 'Tổng quan'}
          </span>
          <span
            className={`admin-workspace-status${writesEnabled ? ' is-enabled' : ''}`}
          >
            {writesEnabled ? 'Sẵn sàng biên tập' : 'Chế độ chỉ đọc'}
          </span>
        </header>
        {changingPage && (
          <div className="admin-loading" role="status">
            Đang tải dữ liệu quản trị…
          </div>
        )}
        <main
          id="main-content"
          className="admin-main"
          tabIndex={-1}
          aria-busy={changingPage}
        >
          {!writesEnabled && (
            <p className="admin-notice" role="status">
              <strong>Chế độ chỉ đọc.</strong> Chưa cho phép ghi nội dung. Cần
              hoàn tất kiểm tra RLS và áp dụng migration trước khi bật quyền
              ghi.
            </p>
          )}
          <Outlet />
        </main>
      </div>
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
