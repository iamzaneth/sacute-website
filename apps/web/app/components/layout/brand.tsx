import { Link } from 'react-router';
import { organization } from '@sacute/shared';

export const centerProfile = {
  favicon: '/branding/profile/favicon.svg',
  cover: {
    src: '/branding/profile/frame-03.svg',
    width: 1573,
    height: 590,
    alt: 'Ảnh bìa SACUTE — Compassion & Fulfillment, các hoạt động tư vấn và hỗ trợ sinh viên.',
  },
  avatar: {
    src: '/branding/profile/avatar.jpg',
    width: 200,
    height: 200,
    alt: 'Ảnh đại diện Trung tâm Tư vấn và Hỗ trợ Sinh viên SACUTE',
  },
  avatar2: {
    src: '/branding/profile/avatar-2.svg',
    width: 200,
    height: 200,
    alt: 'Ảnh đại diện Trung tâm Tư vấn và Hỗ trợ Sinh viên SACUTE',
  },
} as const;

export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <img
      className={`brand-logo ${className}`}
      src={centerProfile.avatar.src}
      width={centerProfile.avatar.width}
      height={centerProfile.avatar.height}
      alt={centerProfile.avatar.alt}
      decoding="async"
    />
  );
}

export function BrandLogo2({ className = '' }: { className?: string }) {
  return (
    <img
      className={`brand-logo ${className}`}
      src={centerProfile.avatar2.src}
      width={centerProfile.avatar2.width}
      height={centerProfile.avatar2.height}
      alt={centerProfile.avatar2.alt}
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
      {variant !== 'drawer' && <BrandLogo />}
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
