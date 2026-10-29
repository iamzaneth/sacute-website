import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { SectionHeading } from '../components/ui';
import { BrandLogo } from '../components/brand';
import { ProcessSteps } from '../features/recruitment/process-steps';
import { TeamExplorer } from '../features/recruitment/team-explorer';
import { pageMeta } from '../lib/seo';

export const meta = () =>
  pageMeta(
    'Tuyển thành viên',
    'Tìm hiểu các ban hoạt động tại SACUTE, bao gồm Truyền thông, Hành chính - Văn phòng, Học tập, Hội thảo Kỹ năng và Nhà trọ - Việc làm.',
    '/recruitment',
  );
const faq = [
  [
    'SACUTE đang tuyển thành viên không?',
    'Hiện chưa có đợt tuyển thành viên được công bố trên website. Thời gian và đường dẫn đăng ký sẽ được cập nhật sau khi có xác nhận.',
  ],
  [
    'Điều kiện tham gia là gì?',
    'Bạn có thể xem yêu cầu công việc của từng ban ở phần giới thiệu phía trên. Điều kiện và hướng dẫn đăng ký của mỗi đợt tuyển sẽ được cập nhật khi có thông báo được xác nhận.',
  ],
  [
    'Mình có thể đăng ký ở đâu?',
    'Website hiện chưa tiếp nhận hồ sơ. Khi có đợt tuyển, hướng dẫn và kênh đăng ký chính thức sẽ được công bố tại trang này.',
  ],
  [
    'Thành viên sẽ tham gia những hoạt động nào?',
    'Mở từng ban để xem mô tả công việc, yêu cầu và quyền lợi theo nội dung tuyển thành viên được cung cấp tại trang này.',
  ],
];
export default function Recruitment() {
  return (
    <div className="page recruitment-page">
      <header className="recruitment-hero">
        <div className="recruitment-hero-copy">
          <p className="eyebrow">TRỞ THÀNH MỘT PHẦN CỦA SACUTE</p>
          <h1>
            Tuyển thành viên <span>SACUTE</span>
          </h1>
          <p>
            Tìm hiểu 5 ban hoạt động, khám phá công việc phù hợp với sở thích và
            cách bạn có thể đóng góp cho cộng đồng sinh viên.
          </p>
          <a className="button button-primary" href="#teams">
            Khám phá 5 ban
            <ArrowDownRight size={18} aria-hidden="true" />
          </a>
        </div>
        <div className="recruitment-hero-brand">
          <BrandLogo />
          <span>5 BAN · CÙNG TÌM HIỂU</span>
        </div>
      </header>
      <div className="recruitment-status">
        <span className="status-chip">
          <span />
          Chưa có đợt tuyển được công bố
        </span>
        <p>
          Thời gian và cách đăng ký sẽ được cập nhật khi có thông báo chính
          thức.
        </p>
      </div>
      <TeamExplorer />
      <section className="process-section">
        <div>
          <p className="eyebrow">CHUẨN BỊ CHO BƯỚC TIẾP THEO</p>
          <h2>
            Theo dõi thông tin
            <br />
            tham gia
          </h2>
          <p>
            Quy trình tuyển chính thức sẽ được cập nhật sau. Trong lúc chờ, bạn
            có thể:
          </p>
        </div>
        <ProcessSteps
          steps={[
            {
              title: 'Tìm hiểu về SACUTE',
              description:
                'Khám phá thông tin và hoạt động được công bố trên website.',
            },
            {
              title: 'Theo dõi thông báo mới',
              description:
                'Kiểm tra trang tuyển thành viên để biết khi có thông tin được xác nhận.',
            },
            {
              title: 'Đọc hướng dẫn khi được công bố',
              description:
                'Xem kỹ điều kiện và kênh đăng ký chính thức trước khi tham gia.',
            },
          ]}
        />
      </section>
      <section className="faq-section">
        <SectionHeading
          eyebrow="BẠN CÓ THỂ THẮC MẮC"
          title="Câu hỏi thường gặp"
        />
        <div className="faq-list">
          {faq.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <div className="recruitment-contact">
        <p>Còn điều bạn muốn tìm hiểu?</p>
        <Link className="text-link" to="/contact">
          Xem thông tin liên hệ <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
