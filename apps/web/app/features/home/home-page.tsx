import { Link } from 'react-router';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  GraduationCap,
  HeartHandshake,
  Users,
} from 'lucide-react';
import { ActionLink, EmptyState, SectionHeading } from '../../components/ui';
import { StudentIllustration } from './student-illustration';

const destinations = [
  {
    to: '/information',
    icon: BookOpen,
    label: 'Thông tin sinh viên',
    text: 'Thông báo và những cập nhật cần biết.',
    number: '01',
  },
  {
    to: '/scholarships',
    icon: GraduationCap,
    label: 'Cơ hội học bổng',
    text: 'Theo dõi thông tin học bổng được công bố.',
    number: '02',
  },
  {
    to: '/events',
    icon: CalendarDays,
    label: 'Sự kiện & hoạt động',
    text: 'Khám phá các hoạt động dành cho sinh viên.',
    number: '03',
  },
];
export function HomePage() {
  return (
    <div className="page home-page">
      <div className="welcome-line">
        <span>
          <span className="tiny-dot" />
          CHÀO MỪNG BẠN ĐẾN VỚI SACUTE
        </span>
        <a href="#explore">
          Cùng khám phá <ArrowDown size={14} aria-hidden="true" />
        </a>
      </div>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">TRUNG TÂM TƯ VẤN VÀ HỖ TRỢ SINH VIÊN</p>
          <h1 id="hero-title">
            Thông tin & hỗ trợ
            <br />
            <span>cho sinh viên.</span>
          </h1>
          <p className="hero-description">
            Một nơi để tìm thông tin, khám phá hoạt động và kết nối với Trung
            tâm Tư vấn và Hỗ trợ Sinh viên.
          </p>
          <div className="hero-actions">
            <ActionLink to="/information">Khám phá thông tin</ActionLink>
            <Link className="hero-contact" to="/contact">
              Liên hệ SACUTE <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="hero-footnote">
            <span className="mini-symbol">
              <HeartHandshake size={18} aria-hidden="true" />
            </span>
            <span>Dành cho hành trình sinh viên của bạn</span>
          </div>
        </div>
        <StudentIllustration />
      </section>
      <section
        className="destinations"
        id="explore"
        aria-label="Nội dung dành cho bạn"
      >
        {destinations.map(({ to, icon: Icon, label, text, number }) => (
          <Link className="destination" key={to} to={to}>
            <div className="destination-top">
              <Icon size={26} strokeWidth={1.4} aria-hidden="true" />
              <span>{number}</span>
            </div>
            <h2>
              {label}
              <ArrowUpRight size={19} aria-hidden="true" />
            </h2>
            <p>{text}</p>
          </Link>
        ))}
      </section>
      <section className="about-strip">
        <div className="about-label">
          <span className="eyebrow">VỀ CHÚNG MÌNH</span>
          <h2>
            Xin chào,
            <br /> đây là SACUTE<span>.</span>
          </h2>
        </div>
        <div>
          <p>
            Trung tâm Tư vấn và Hỗ trợ Sinh viên thuộc Trường Đại học Công nghệ
            Kỹ thuật TP.HCM. Website là không gian tổng hợp thông tin và kết nối
            dành cho sinh viên.
          </p>
          <Link className="text-link" to="/information">
            Tìm hiểu thông tin từ SACUTE{' '}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <section className="latest-section">
        <SectionHeading
          eyebrow="CẬP NHẬT TỪ SACUTE"
          title="Thông tin mới nhất"
          to="/information"
        />
        <div className="latest-grid">
          <EmptyState icon={Bell} title="Thông tin mới đang được chuẩn bị">
            Các thông báo sẽ xuất hiện tại đây sau khi nội dung chính thức được
            xác nhận.
          </EmptyState>
          <aside className="update-note">
            <span className="note-label">
              <Check size={14} aria-hidden="true" />
              LƯU Ý DÀNH CHO BẠN
            </span>
            <h3>
              Đúng thông tin.
              <br /> Dễ tìm kiếm.
            </h3>
            <p>
              Hãy kiểm tra nội dung công bố và thời gian cập nhật trước khi đăng
              ký một chương trình.
            </p>
            <Link to="/contact" className="text-link">
              Bạn cần hỗ trợ? <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </section>
      <div className="opportunities-grid">
        <section>
          <SectionHeading
            eyebrow="CƠ HỘI HỌC TẬP"
            title="Thông tin học bổng"
            to="/scholarships"
            linkLabel="Khám phá"
          />
          <EmptyState
            compact
            icon={GraduationCap}
            title="Chưa có học bổng được công bố"
          >
            Thông tin học bổng đang chờ cập nhật chính thức.
          </EmptyState>
        </section>
        <section>
          <SectionHeading
            eyebrow="KẾT NỐI & THAM GIA"
            title="Sự kiện nổi bật"
            to="/events"
            linkLabel="Khám phá"
          />
          <EmptyState
            compact
            icon={CalendarDays}
            title="Chờ những hoạt động sắp tới"
          >
            Lịch hoạt động sẽ được cập nhật sau khi xác nhận.
          </EmptyState>
        </section>
      </div>
      <section className="recruitment-banner">
        <div className="recruitment-symbol" aria-hidden="true">
          <Users size={54} strokeWidth={1} />
          <span>+</span>
        </div>
        <div>
          <p className="eyebrow">TRỞ THÀNH MỘT PHẦN CỦA SACUTE</p>
          <h2>Bạn muốn cùng tham gia?</h2>
          <p>Tìm hiểu về thành viên và theo dõi thông báo tuyển mới.</p>
          <span className="status-chip">
            <span />
            Chưa có đợt tuyển được công bố
          </span>
        </div>
        <ActionLink to="/recruitment" secondary>
          Tìm hiểu thêm
        </ActionLink>
      </section>
    </div>
  );
}
