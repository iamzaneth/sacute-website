import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
  useNavigation,
  Link,
  useLocation,
  useMatches,
} from 'react-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { ToastProvider, useToast } from './components/toast/toast';
import { Sidebar, InstitutionalHeader, Footer } from './components/layout';
import { siteConfig } from './lib/site-config';
import { usePublicFreshness } from './features/content/navigation-feedback';
import { centerProfile } from './components/brand';
import './styles/app.css';
import './styles/recruitment.css';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f97316" />
        <link
          rel="icon"
          type="image/svg+xml"
          sizes="any"
          href={centerProfile.favicon}
        />
        <Meta />
        <Links />
        {siteConfig.origin && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: siteConfig.organization.name,
                alternateName: 'SACUTE',
                url: siteConfig.origin,
                email: siteConfig.organization.email,
                address: siteConfig.organization.address,
                sameAs: siteConfig.organization.socialLinks.map(
                  (social) => social.url,
                ),
                parentOrganization: {
                  '@type': 'CollegeOrUniversity',
                  name: siteConfig.organization.institution,
                },
              }).replace(/</g, '\\u003c'),
            }}
          />
        )}
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Chuyển đến nội dung chính
        </a>
        <ToastProvider>{children}</ToastProvider>
        <ScrollRestoration
          getKey={(location) =>
            /^\/(information|scholarships|events)$/.test(location.pathname)
              ? location.pathname + location.search
              : location.key
          }
        />
        <Scripts />
      </body>
    </html>
  );
}
export default function App() {
  const { pathname } = useLocation();
  const navigation = useNavigation();
  usePublicFreshness();
  useLoginNotification();
  if (pathname === '/admin' || pathname.startsWith('/admin/'))
    return <Outlet />;
  return (
    <div className="site-shell">
      {navigation.state === 'loading' && (
        <div className="navigation-progress" role="status">
          <span className="sr-only">Đang chuyển trang…</span>
        </div>
      )}
      <InstitutionalHeader />
      <Sidebar />
      <div className="site-body">
        <main
          id="main-content"
          tabIndex={-1}
          aria-busy={navigation.state === 'loading'}
        >
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}

function useLoginNotification() {
  const navigation = useNavigation();
  const location = useLocation();
  const matches = useMatches();
  const toast = useToast();
  const loginPending = useRef(false);
  useEffect(() => {
    if (
      navigation.formMethod?.toLowerCase() === 'post' &&
      navigation.formAction &&
      new URL(navigation.formAction, window.location.origin).pathname ===
        '/admin/login'
    ) {
      loginPending.current = true;
    }
    if (navigation.state !== 'idle' || !loginPending.current) return;
    loginPending.current = false;
    if (
      matches.some(
        (match) =>
          match.id === 'routes/admin-layout' &&
          !!(match.data as { email?: string } | undefined)?.email,
      )
    ) {
      toast.success('Đăng nhập thành công.', { id: `login:${location.key}` });
    }
  }, [navigation, location.key, matches, toast]);
}
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <main className="error-page">
      <p className="eyebrow">SACUTE</p>
      <h1>
        {isRouteErrorResponse(error) && error.status === 404
          ? 'Không tìm thấy trang'
          : 'Không thể tải nội dung'}
      </h1>
      <p>
        {isRouteErrorResponse(error) &&
        error.status !== 404 &&
        typeof error.data === 'string'
          ? error.data
          : 'Vui lòng quay lại trang chủ hoặc thử lại sau.'}
      </p>
      <Link className="button button-primary" to="/">
        Về trang chủ
      </Link>
    </main>
  );
}
