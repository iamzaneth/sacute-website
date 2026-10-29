import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ClipboardList,
  Gift,
  GraduationCap,
  House,
  Megaphone,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import {
  recruitmentTeams,
  type RecruitmentTeam,
} from './data/recruitment-teams';
import { SectionHeading } from '../../components/ui';

const teamIcons: Record<RecruitmentTeam['icon'], LucideIcon> = {
  megaphone: Megaphone,
  clipboard: ClipboardList,
  'graduation-cap': GraduationCap,
  presentation: Presentation,
  house: House,
};

function revealTeam(slug: string) {
  const details = document.getElementById(slug);
  if (!(details instanceof HTMLDetailsElement)) return;
  details.open = true;
  details.querySelector('summary')?.focus({ preventScroll: true });
  details.scrollIntoView({ block: 'start', behavior: 'instant' });
}

function TeamContentSection({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: readonly string[];
  icon: LucideIcon;
}) {
  return (
    <section className="team-content-section">
      <h4>
        <Icon size={19} aria-hidden="true" />
        {title}
      </h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function TeamExplorer() {
  const [activeTeam, setActiveTeam] = useState<string>();
  useEffect(() => {
    const followHash = () => {
      // Only known ASCII slugs are accepted; malformed hashes leave native navigation intact.
      const slug = window.location.hash.slice(1);
      if (recruitmentTeams.some((team) => team.slug === slug)) revealTeam(slug);
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, []);

  return (
    <section
      id="teams"
      className="team-explorer"
      aria-label="Các ban của SACUTE"
    >
      <SectionHeading
        eyebrow="TÌM NƠI PHÙ HỢP VỚI BẠN"
        title="5 ban, nhiều cách để đóng góp"
      />
      <p className="team-introduction">
        Bạn thích sáng tạo, tổ chức hay hỗ trợ sinh viên? Chọn một ban để tìm
        hiểu công việc, yêu cầu và quyền lợi tham gia.
      </p>
      <nav className="team-overview" aria-label="Khám phá 5 ban SACUTE">
        {recruitmentTeams.map((team, index) => {
          const Icon = teamIcons[team.icon];
          return (
            <a
              key={team.id}
              href={`#${team.slug}`}
              onClick={() => revealTeam(team.slug)}
              aria-current={activeTeam === team.id ? 'true' : undefined}
              className="team-card"
            >
              <span className="team-card-top">
                <span className="team-icon">
                  <Icon size={25} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span className="team-number">0{index + 1}</span>
              </span>
              <h3>{team.name}</h3>
              <p>{team.shortDescription}</p>
              <span className="team-card-action">
                Tìm hiểu thêm
                <ArrowUpRight size={17} aria-hidden="true" />
              </span>
            </a>
          );
        })}
      </nav>
      <div className="team-details-heading">
        <span className="eyebrow">TÌM HIỂU TỪNG BAN</span>
        <span>
          <ArrowDownRight size={16} aria-hidden="true" />
          Mở một ban để xem chi tiết
        </span>
      </div>
      <div className="team-details">
        {recruitmentTeams.map((team, index) => {
          const Icon = teamIcons[team.icon];
          return (
            <details
              className="team-detail"
              id={team.slug}
              name="recruitment-teams"
              key={team.id}
              onToggle={(event) => {
                if (event.currentTarget.open) setActiveTeam(team.id);
                else
                  setActiveTeam((current) =>
                    current === team.id ? undefined : current,
                  );
              }}
            >
              <summary>
                <span className="team-icon">
                  <Icon size={24} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span className="team-summary-copy">
                  <span className="eyebrow">BAN 0{index + 1}</span>
                  <h3>{team.name}</h3>
                </span>
                <span className="team-disclosure-label">
                  <span className="team-expand-label">Xem chi tiết</span>
                  <span className="team-collapse-label">Thu gọn</span>
                </span>
                <ChevronDown
                  className="team-chevron"
                  size={21}
                  aria-hidden="true"
                />
              </summary>
              <div className="team-detail-body">
                <p className="team-detail-intro">{team.shortDescription}</p>
                <div className="team-content-columns">
                  <TeamContentSection
                    title="Mô tả công việc"
                    icon={BriefcaseBusiness}
                    items={team.responsibilities}
                  />
                  <TeamContentSection
                    title="Yêu cầu công việc"
                    icon={Check}
                    items={team.requirements}
                  />
                  <TeamContentSection
                    title="Quyền lợi tham gia"
                    icon={Gift}
                    items={team.benefits}
                  />
                </div>
                {team.editorialNote && (
                  <aside className="editorial-note">
                    <strong>Lưu ý về nội dung</strong>
                    <p>{team.editorialNote}</p>
                  </aside>
                )}
                <a className="text-link team-back-link" href="#teams">
                  Khám phá các ban khác
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
