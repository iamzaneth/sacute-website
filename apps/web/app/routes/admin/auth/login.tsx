import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  data,
  redirect,
  Link,
  useLocation,
} from 'react-router';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { BrandLogo } from '~/components/layout/brand';
import { useToastFeedback } from '~/components/toast/toast';
import {
  adminHeaders,
  assertSameOrigin,
  createAuthContext,
  privateHeaders,
  readAdminForm,
  verifyAdmin,
} from '~/services/admin/auth.server';
import type { Route } from './+types/login';
import '~/styles/admin.css';
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
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const busy = navigation.state !== 'idle';
  useToastFeedback(result, result?.error, 'error');
  useToastFeedback(
    location.key,
    state.logout
      ? 'Đã đăng xuất an toàn.'
      : state.expired
        ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : undefined,
    state.logout ? 'success' : 'warning',
    `auth:${location.key}`,
  );
  return (
    <main id="main-content" className="admin-login" tabIndex={-1}>
      <div className="admin-card">
        <Link
          className="admin-login-brand"
          to="/"
          aria-label="SACUTE Quản trị nội dung — Trang chủ"
        >
          <BrandLogo />
          <span>
            SACUTE <small>QUẢN TRỊ NỘI DUNG</small>
          </span>
        </Link>
        <h1>Đăng nhập quản trị</h1>
        <p className="admin-login-description">Chào mừng bạn trở lại.</p>
        <Form method="post" className="admin-form">
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              maxLength={254}
              placeholder="Email của bạn"
              spellCheck={false}
              autoCapitalize="none"
              required
            />
          </label>
          <div className="admin-login-password">
            <label htmlFor="admin-password">Mật khẩu</label>
            <div className="admin-password-input">
              <input
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                maxLength={1024}
                placeholder="Nhập mật khẩu"
                required
              />
              <button
                type="button"
                className="admin-password-toggle"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((shown) => !shown)}
              >
                {showPassword ? (
                  <EyeOff size={19} aria-hidden="true" />
                ) : (
                  <Eye size={19} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <button className="button button-primary" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
            {busy ? (
              <LoaderCircle
                className="admin-login-spinner"
                size={18}
                aria-hidden="true"
              />
            ) : (
              <ArrowRight size={18} aria-hidden="true" />
            )}
          </button>
        </Form>
        <Link className="admin-login-back" to="/">
          <ArrowLeft size={15} aria-hidden="true" /> Về trang chủ
        </Link>
      </div>
    </main>
  );
}
export { ErrorBoundary } from '~/routes/admin/layout';
