import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { organization } from '@sacute/shared';
import { PageIntro } from '../components/ui';
import { pageMeta } from '../lib/seo';

export const meta = () =>
  pageMeta(
    'Liên hệ',
    'Liên hệ SACUTE qua email sacute@hcmute.edu.vn, Facebook, TikTok hoặc đến Số 01, Võ Văn Ngân, P. Thủ Đức, TP. HCM.',
    '/contact',
  );
const contactChannels = [
  {
    icon: Mail,
    label: 'Địa chỉ email',
    value: organization.email,
    href: organization.email ? `mailto:${organization.email}` : null,
  },
  {
    icon: Phone,
    label: 'Số điện thoại',
    value: organization.phone,
    href: organization.phone ? `tel:${organization.phone}` : null,
  },
  {
    icon: MapPin,
    label: 'Địa chỉ trung tâm',
    value: organization.address,
    href: organization.mapUrl,
  },
];
export default function Contact() {
  return (
    <div className="page">
      <PageIntro
        number="04"
        eyebrow="CHÚNG MÌNH Ở ĐÂY"
        title="Kết nối với SACUTE"
      >
        Tìm kênh liên hệ phù hợp để trao đổi thông tin và tìm hiểu về hoạt động
        của trung tâm.
      </PageIntro>
      <div className="contact-layout">
        <section>
          <h2 className="contact-heading">Thông tin liên hệ</h2>
          <p className="muted">
            {organization.name}
            <br />
            {organization.institution}
          </p>
          <div className="contact-channels">
            {contactChannels.map(({ icon: Icon, label, value, href }) => (
              <div className="contact-channel" key={label}>
                <span className="channel-icon">
                  <Icon size={21} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <div>
                  <h3>{label}</h3>
                  {value ? (
                    href ? (
                      <a href={href}>{value}</a>
                    ) : (
                      <p className="contact-value">{value}</p>
                    )
                  ) : (
                    <p>Đang chờ cập nhật chính thức</p>
                  )}
                </div>
              </div>
            ))}
            {organization.socialLinks.map((social) => (
              <div className="contact-channel" key={social.name}>
                <span className="channel-icon">
                  <MessageCircle
                    size={21}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <h3>{social.name}</h3>
                  <a
                    className="contact-information"
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {social.name === 'TikTok'
                      ? '@sacute.2015'
                      : 'Hỗ trợ sinh viên SACUTE'}
                    <ArrowUpRight size={14} aria-hidden="true" />
                    <span className="sr-only"> (mở trong tab mới)</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="contact-aside">
          <p className="eyebrow">TRƯỚC KHI LIÊN HỆ</p>
          <h2>
            Bạn đang tìm
            <br />
            thông tin gì?
          </h2>
          <p>
            Chuẩn bị câu hỏi và nội dung cần trao đổi sẽ giúp bạn trình bày nhu
            cầu rõ ràng hơn.
          </p>
          <div className="notice-box">
            <strong>Trao đổi trực tiếp qua email</strong>
            <p>
              Bạn có thể gửi email đến địa chỉ của trung tâm hoặc truy cập các
              kênh mạng xã hội phía trên. Biểu mẫu gửi tin nhắn và bản đồ trên
              website chưa được kích hoạt.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
