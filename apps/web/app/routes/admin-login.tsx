import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  data,
  redirect,
} from 'react-router';
import {
  adminHeaders,
  assertSameOrigin,
  createAuthContext,
  privateHeaders,
  readAdminForm,
  verifyAdmin,
} from '../services/admin-auth.server';
import type { Route } from './+types/admin-login';
import '../styles/admin.css';
export const headers = adminHeaders;
export const meta = () => [
  { title: 'Đăng nhập quản trị | SACUTE' },
  { name: 'robots', content: 'noindex, nofollow' },
];
export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  return data(
    { expired: params.has('expired'), logout: params.has('logout') },
    { headers: privateHeaders() },
  );
}
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const form = await readAdminForm(request, 8192);
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !password ||
    password.length > 1024
  )
    return data(
      { error: 'Nhập email và mật khẩu hợp lệ.' },
      { status: 422, headers: privateHeaders() },
    );
  const context = createAuthContext(request);
  try {
    const result = await context.db.auth.signInWithPassword({
      email,
      password,
    });
    if (result.error)
      return data(
        {
          error:
            result.error.status === 429
              ? 'Đã thử đăng nhập quá nhiều lần. Vui lòng đợi rồi thử lại.'
              : 'Không thể đăng nhập. Kiểm tra thông tin hoặc thử lại sau.',
        },
        {
          status: result.error.status === 429 ? 429 : 401,
          headers: context.headers,
        },
      );
    await verifyAdmin(context);
  } catch (error) {
    if (error instanceof Response) throw error;
    return data(
      { error: 'Dịch vụ đăng nhập tạm thời không khả dụng. Vui lòng thử lại.' },
      { status: 503, headers: context.headers },
    );
  }
  // Fixed destination; no user controlled return URL.
  return redirect('/admin', { status: 303, headers: context.headers });
}
export default function AdminLogin() {
  const state = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  return (
    <main id="main-content" className="admin-login" tabIndex={-1}>
      <div className="admin-card">
        <p className="eyebrow">SACUTE · Quản trị nội dung</p>
        <h1>Đăng nhập quản trị</h1>
        <p>Dành cho biên tập viên được cấp quyền.</p>
        {state.expired && (
          <p role="status">
            Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập
            lại.
          </p>
        )}
        {state.logout && <p role="status">Đã đăng xuất an toàn.</p>}
        {result?.error && (
          <p className="admin-field-error" role="alert">
            {result.error}
          </p>
        )}
        <Form method="post" className="admin-form">
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              maxLength={254}
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              required
            />
          </label>
          <button
            className="button button-primary"
            disabled={navigation.state !== 'idle'}
          >
            {navigation.state !== 'idle' ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </Form>
      </div>
    </main>
  );
}
export { ErrorBoundary } from './admin-layout';
