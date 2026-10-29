import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
  Link,
} from 'react-router';
import { useState, type ReactNode } from 'react';
import { Sidebar, InstitutionalHeader, Footer } from './components/layout';
import { siteConfig } from './lib/site-config';
import './styles/app.css';
import './styles/recruitment.css';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f97316" />
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
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  return (
    <div
      className={`site-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />
      <div className="site-body">
        <InstitutionalHeader />
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
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
      <p>Vui lòng quay lại trang chủ hoặc thử lại sau.</p>
      <Link className="button button-primary" to="/">
        Về trang chủ
      </Link>
    </main>
  );
}
