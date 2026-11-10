import { Form, Link, useSearchParams } from 'react-router';
import { BookOpen, CalendarDays, GraduationCap, Search, X } from 'lucide-react';
import type { ContentItem, ContentKind, ListResponse } from '@sacute/shared';
import { EmptyState, PageIntro } from '../../components/ui';
import { ArticleCard } from './article-card';

const copy = {
  information: {
    number: '01',
    eyebrow: 'THÔNG TIN SINH VIÊN',
    title: 'Thông tin từ SACUTE',
    description:
      'Tìm thông báo, tin tức và những cập nhật dành cho sinh viên tại một nơi.',
    empty: 'Chưa có thông báo được công bố',
    detail:
      'Nội dung đang được chuẩn bị. Các thông báo chính thức sẽ được cập nhật tại đây sau khi xác nhận.',
    icon: BookOpen,
    categories: ['Thông báo', 'Hoạt động'],
  },
  scholarships: {
    number: '02',
    eyebrow: 'CƠ HỘI HỌC TẬP',
    title: 'Thông tin học bổng',
    description:
      'Theo dõi các cơ hội học bổng, điều kiện và hướng dẫn khi có thông báo chính thức.',
    empty: 'Chưa có học bổng được công bố',
    detail:
      'Hiện chưa có thông tin học bổng được xác nhận. Đơn vị trao, điều kiện và thời hạn sẽ được cập nhật cùng thông báo.',
    icon: GraduationCap,
    categories: ['Học bổng', 'Hỗ trợ học tập'],
  },
  events: {
    number: '03',
    eyebrow: 'KẾT NỐI & THAM GIA',
    title: 'Sự kiện nổi bật',
    description:
      'Theo dõi câu chuyện, hoạt động và những khoảnh khắc từ các chương trình đồng hành cùng sinh viên của SACUTE.',
    empty: 'Chưa có sự kiện được công bố',
    detail:
      'Lịch trình, địa điểm và hướng dẫn tham gia sẽ xuất hiện khi có thông tin chính thức. Hẹn gặp bạn ở những cập nhật sắp tới.',
    icon: CalendarDays,
    categories: [] as string[],
  },
};
export function ContentList({
  kind,
  items,
  meta,
  categoryOptions,
}: {
  kind: ContentKind;
  items: ContentItem[];
  meta: ListResponse<ContentItem>['meta'];
  categoryOptions?: string[];
}) {
  const page = copy[kind];
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const category =
    params.get('category') ?? (kind === 'information' ? 'Thông báo' : '');
  const hasFilters = Boolean(query || category);
  const categories = categoryOptions ?? page.categories;
  const visible = items;
  function selectCategory(value: string) {
    const next = new URLSearchParams(params);
    // An explicit empty category distinguishes “all” from the initial default.
    next.set('category', value);
    next.delete('page');
    setParams(next, { preventScrollReset: true });
  }
  return (
    <div
      className={`page${kind === 'events' || kind === 'information' ? ' content-feed-page' : ''}`}
    >
      <PageIntro number={page.number} eyebrow={page.eyebrow} title={page.title}>
        {page.description}
      </PageIntro>
      <div className="content-toolbar">
        <Form className="search-form" role="search">
          <Search size={19} aria-hidden="true" />
          <label className="sr-only" htmlFor="content-search">
            Tìm kiếm nội dung
          </label>
          <input
            key={query}
            id="content-search"
            name="q"
            defaultValue={query}
            placeholder={
              kind === 'events' ? 'Tìm bài viết sự kiện…' : 'Tìm kiếm nội dung…'
            }
            maxLength={200}
          />
          <input type="hidden" name="category" value={category} />
          <button className="button button-primary" type="submit">
            Tìm kiếm
          </button>
        </Form>
        <span className="result-count" aria-live="polite">
          {meta.total} bài viết
        </span>
      </div>
      <div
        className="filter-tabs"
        role="group"
        aria-label={
          kind === 'events' ? 'Lọc theo sự kiện' : 'Lọc theo chuyên mục'
        }
      >
        {['', ...categories].map((value) => (
          <button
            key={value}
            onClick={() => selectCategory(value)}
            aria-pressed={value === category}
            className={value === category ? 'selected' : ''}
          >
            {value || 'Tất cả'}
          </button>
        ))}
        {hasFilters && (
          <button
            className="clear-filters"
            onClick={() =>
              setParams({ category: '' }, { preventScrollReset: true })
            }
          >
            <X size={14} aria-hidden="true" />
            Xóa bộ lọc
          </button>
        )}
      </div>
      <div className="listing-area">
        {visible.length ? (
          <div className="article-list">
            {visible.map((item) => (
              <ArticleCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            headingAs="h2"
            icon={page.icon}
            title={query || category ? 'Không có nội dung phù hợp' : page.empty}
          >
            {query || category
              ? 'Bạn có thể thử từ khóa khác hoặc xóa bộ lọc để xem toàn bộ nội dung.'
              : page.detail}
          </EmptyState>
        )}
      </div>
      {meta.total > meta.limit && (
        <nav className="filter-tabs" aria-label="Phân trang">
          {meta.page > 1 && (
            <Link
              to={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(meta.page - 1) })}`}
            >
              Trang trước
            </Link>
          )}
          <span>
            Trang {meta.page} / {Math.ceil(meta.total / meta.limit)}
          </span>
          {meta.page * meta.limit < meta.total && (
            <Link
              to={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(meta.page + 1) })}`}
            >
              Trang sau
            </Link>
          )}
        </nav>
      )}
      {kind !== 'events' && (
        <aside className="information-note">
          <span className="tiny-dot" />
          <p>
            Chỉ những thông tin đã được xác nhận mới được công bố. Website hiện
            đang trong giai đoạn hoàn thiện nội dung.
          </p>
        </aside>
      )}
    </div>
  );
}
