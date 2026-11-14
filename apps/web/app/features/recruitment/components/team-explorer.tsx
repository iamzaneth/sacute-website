import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
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
} from '~/features/recruitment/data/recruitment-teams';
import { SectionHeading } from '~/components/ui';

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
  const navigate = useNavigate();
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
        title="5 ban - Nhiều cách đóng góp"
      />
      <p className="team-introduction">
        Bạn thích sáng tạo, tổ chức hay hỗ trợ sinh viên? Chọn một ban để tìm
        hiểu công việc, yêu cầu và quyền lợi tham gia.
      </p>
      <div className="team-details">
        {recruitmentTeams.map((team) => {
          const Icon = teamIcons[team.icon];
          return (
            <details
              className="team-detail"
              id={team.slug}
              name="recruitment-teams"
              key={team.id}
              onToggle={(event) => {
                if (
                  event.currentTarget.open &&
                  window.location.hash !== `#${team.slug}`
                ) {
                  void navigate(
                    { hash: `#${team.slug}` },
                    { preventScrollReset: true },
                  );
                }
              }}
            >
              <summary>
                <span className="team-icon">
                  <Icon size={24} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span className="team-summary-copy">
                  <h3>{team.name}</h3>
                  <p className="team-summary-description">
                    {team.shortDescription}
                  </p>
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
