import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  Home,
  Mail,
  Menu,
  MapPin,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  X,
} from 'lucide-react';
import { navigation, organization } from '@sacute/shared';
import { Brand, BrandLogo } from './brand';

const icons = [Home, BookOpen, GraduationCap, CalendarDays, Mail, Users];

function Navigation({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <nav aria-label="Điều hướng chính" className="nav-items">
      {navigation.map((item, index) => {
        const Icon = icons[index];
        return (
          <NavLink
            key={item.path}
            to={item.path}
            discover="render"
            prefetch={
              ['/contact', '/recruitment'].includes(item.path)
                ? 'intent'
                : 'none'
            }
            end={item.path === '/'}
            onClick={onNavigate}
            aria-label={item.label}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
            <span>{item.label}</span>
            <ChevronRight
              className="nav-chevron"
              size={15}
              aria-hidden="true"
            />
          </NavLink>
        );
      })}
    </nav>
  );
}
export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className="sidebar"
      aria-label="Thanh điều hướng"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !collapsed) {
          event.preventDefault();
          onToggle();
          event.currentTarget
            .querySelector<HTMLButtonElement>('.sidebar-toggle')
            ?.focus();
        }
      }}
    >
      <button
        type="button"
        className="sidebar-toggle icon-button"
        onClick={onToggle}
        aria-label={
          collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'
        }
        aria-expanded={!collapsed}
        aria-controls="desktop-navigation"
        title={
          collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'
        }
      >
        {collapsed ? (
          <PanelLeftOpen size={21} aria-hidden="true" />
        ) : (
          <PanelLeftClose size={21} aria-hidden="true" />
        )}
      </button>
      <Brand />
      <div className="nav-caption">KHÁM PHÁ SACUTE</div>
      <div id="desktop-navigation">
        <Navigation collapsed={collapsed} />
      </div>
      <div className="sidebar-bottom">
        <p>Bạn cần được hỗ trợ?</p>
        <Link
          to="/contact"
          aria-label="Liên hệ SACUTE"
          title={collapsed ? 'Liên hệ SACUTE' : undefined}
        >
          <HeartHandshake size={23} strokeWidth={1.4} aria-hidden="true" />
          <span>Kết nối với SACUTE</span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <span>THÔNG TIN CHO SINH VIÊN</span>
      </div>
    </aside>
  );
}
export function InstitutionalHeader() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const closeMenu = () => dialog.current?.close();
  const openMenu = () => {
    dialog.current?.showModal();
    document.body.style.overflow = 'hidden';
    setMenuOpen(true);
  };
  useEffect(() => {
    dialog.current?.close();
  }, [location.pathname]);
  useEffect(() => {
    const breakpoint = window.matchMedia('(min-width: 951px)');
    const closeOnDesktop = () => {
      if (breakpoint.matches) dialog.current?.close();
    };
    breakpoint.addEventListener('change', closeOnDesktop);
    return () => {
      breakpoint.removeEventListener('change', closeOnDesktop);
      document.body.style.overflow = '';
    };
  }, []);
  return (
    <>
      <header className="institution-header">
        <Link to="/" className="header-logo" aria-label="SACUTE — Trang chủ">
          <BrandLogo />
        </Link>
        <div className="institution-copy">
          <span>{organization.institution}</span>
          <strong>{organization.name}</strong>
        </div>
        <button
          className="menu-trigger icon-button"
          ref={trigger}
          aria-label="Mở menu điều hướng"
          aria-haspopup="dialog"
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          onClick={openMenu}
        >
          <Menu size={24} />
        </button>
      </header>
      <dialog
        id="mobile-navigation"
        ref={dialog}
        className="mobile-drawer"
        aria-label="Menu điều hướng"
        onClose={() => {
          setMenuOpen(false);
          document.body.style.overflow = '';
          trigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) closeMenu();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const elements = dialog.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled])',
          );
          if (!elements?.length) return;
          const first = elements[0];
          const last = elements[elements.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="drawer-content">
          <div className="drawer-top">
            <Brand variant="drawer" />
            <button
              className="icon-button"
              onClick={closeMenu}
              aria-label="Đóng menu điều hướng"
              autoFocus
            >
              <X />
            </button>
          </div>
          <Navigation onNavigate={closeMenu} />
          <p className="drawer-note">
            {organization.name}
            <br />
            {organization.institution}
          </p>
        </div>
      </dialog>
    </>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div>
          <Brand variant="footer" />
          <p>{organization.institution}</p>
        </div>
        <section
          className="footer-contact-area"
          aria-labelledby="footer-contact-heading"
        >
          <h2 id="footer-contact-heading">Liên hệ SACUTE</h2>
          <address className="footer-contact">
            <span>
              <MapPin size={17} aria-hidden="true" />
              <span>{organization.address}</span>
            </span>
            <a href={`mailto:${organization.email}`}>
              <Mail size={17} aria-hidden="true" />
              {organization.email}
            </a>
          </address>
          <nav className="footer-socials" aria-label="Mạng xã hội SACUTE">
            {organization.socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={16} aria-hidden="true" />
                {social.name}
                <ArrowUpRight size={14} aria-hidden="true" />
                <span className="sr-only"> (mở trong tab mới)</span>
              </a>
            ))}
          </nav>
        </section>
      </div>
      <div className="footer-bottom">
        <span>SACUTE · Thông tin dành cho sinh viên</span>
        <span>Thông tin chính thức đang được cập nhật.</span>
      </div>
    </footer>
  );
}
