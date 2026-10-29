import { Link } from 'react-router';
import { organization } from '@sacute/shared';

export const logoPath = '/branding/logo-sacute.svg';

export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <img
      className={`brand-logo ${className}`}
      src={logoPath}
      width={258}
      height={258}
      alt="Logo SACUTE — Trung tâm Tư vấn và Hỗ trợ Sinh viên"
      decoding="async"
    />
  );
}

export function Brand({
  variant = 'sidebar',
}: {
  variant?: 'sidebar' | 'drawer' | 'footer';
}) {
  return (
    <Link
      className={`brand brand-${variant}`}
      to="/"
      aria-label="SACUTE — Trang chủ"
    >
      <BrandLogo />
      <span className="brand-caption">
        <strong>SACUTE</strong>
        <span>
          {variant === 'footer'
            ? organization.name
            : 'Tư vấn & hỗ trợ sinh viên'}
        </span>
      </span>
    </Link>
  );
}
