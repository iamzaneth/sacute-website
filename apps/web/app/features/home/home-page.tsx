import { Link } from 'react-router';
import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  GraduationCap,
  Users,
} from 'lucide-react';
import { ActionLink, EmptyState, SectionHeading } from '../../components/ui';
import { localContent } from '@sacute/shared';
import { ArticleCard } from '../content/article-card';
import { centerProfile } from '../../components/brand';

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
      <section
        className="about-strip center-profile"
        aria-labelledby="center-profile-title"
      >
        <img
          {...centerProfile.cover}
          className="center-profile-cover"
          fetchPriority="high"
        />
        <div className="about-label">
          <div>
            <span className="eyebrow">
              TRUNG TÂM TƯ VẤN VÀ HỖ TRỢ SINH VIÊN
            </span>
            <h1 id="center-profile-title">SACUTE — Đồng hành cùng sinh viên</h1>
          </div>
        </div>
        <div>
          <p>
            Trung tâm Tư vấn và Hỗ trợ Sinh viên thuộc Trường Đại học Công nghệ
            Kỹ thuật TP.HCM. Website là không gian tổng hợp thông tin và kết nối
            dành cho sinh viên.
          </p>
        </div>
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
            <h2>{label}</h2>
            <p>{text}</p>
          </Link>
        ))}
      </section>
      <section className="latest-section">
        <SectionHeading
          eyebrow="CẬP NHẬT TỪ SACUTE"
          title="Thông tin mới nhất"
          to="/information"
        />
        <div className="latest-grid">
          {localContent.information.length ? (
            <ArticleCard item={localContent.information[0]} preview />
          ) : (
            <EmptyState icon={Bell} title="Thông tin mới đang được chuẩn bị">
              Các thông báo sẽ xuất hiện tại đây sau khi nội dung chính thức
              được xác nhận.
            </EmptyState>
          )}
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
              Bạn cần hỗ trợ?
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
          {localContent.events.length ? (
            <div className="home-events">
              {localContent.events.slice(0, 2).map((item) => (
                <Link
                  key={item.id}
                  className="home-event"
                  to={`/posts/${item.slug}`}
                >
                  {item.images?.[0] && (
                    <img
                      src={item.images[0].url}
                      alt=""
                      width={112}
                      height={90}
                      loading="lazy"
                    />
                  )}
                  <div>
                    <p className="eyebrow">{item.eventName}</p>
                    <h3>{item.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={CalendarDays}
              title="Chờ những hoạt động sắp tới"
            >
              Lịch hoạt động sẽ được cập nhật sau khi xác nhận.
            </EmptyState>
          )}
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
