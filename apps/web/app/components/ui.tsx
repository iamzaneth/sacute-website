import { Bell, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import type { ReactNode } from 'react';

export function ActionLink({
  to,
  children,
  secondary = false,
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      className={`button ${secondary ? 'button-secondary' : 'button-primary'}`}
      to={to}
    >
      {children}
    </Link>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  to,
  linkLabel = 'Xem tất cả',
}: {
  eyebrow?: string;
  title: string;
  to?: string;
  linkLabel?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {to && (
        <Link className="text-link" to={to}>
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
export function EmptyState({
  icon: Icon = Bell,
  title,
  children,
  compact = false,
  headingAs: Heading = 'h3',
}: {
  icon?: LucideIcon;
  title: string;
  children: ReactNode;
  compact?: boolean;
  headingAs?: 'h2' | 'h3';
}) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      <span className="empty-icon">
        <Icon size={25} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div>
        <Heading>{title}</Heading>
        <p>{children}</p>
      </div>
    </div>
  );
}
export function PageIntro({
  number,
  eyebrow,
  title,
  children,
}: {
  number: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="page-intro">
      <div className="page-kicker">
        <span className="eyebrow">{eyebrow}</span>
        <span className="page-number">{number} / SACUTE</span>
      </div>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}
