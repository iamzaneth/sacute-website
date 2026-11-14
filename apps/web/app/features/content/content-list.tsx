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
import type { PublicPayloads, PublicData } from './public-data';
import { PublicContent } from './public-content';
import { ContentSkeleton, InlineSkeleton } from './content-skeleton';
export function ContentList({
  kind,
  content,
  cacheKey,
}: {
  kind: ContentKind;
  content: PublicData<
    PublicPayloads['information'] & { categories?: string[] }
  > | null;
  cacheKey: string;
}) {
  const page = copy[kind];
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const category =
    params.get('category') ?? (kind === 'information' ? 'Thông báo' : '');
  const hasFilters = Boolean(query || category);
  function selectCategory(value: string) {
    const next = new URLSearchParams(params);
    next.set('category', value);
    next.delete('page');
    setParams(next, { preventScrollReset: true });
  }
  const filters = (categories: string[], loading = false) => (
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
      {loading && <InlineSkeleton />}
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
  );
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
            type="search"
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
          <PublicContent
            content={content}
            cacheKey={cacheKey}
            fallback={<InlineSkeleton />}
            errorFallback={<span>Chưa tải được số bài</span>}
          >
            {(result) => `${result.meta.total} bài viết`}
          </PublicContent>
        </span>
      </div>
      {kind === 'events' ? (
        <PublicContent
          content={content}
          cacheKey={cacheKey}
          fallback={filters([], true)}
          errorFallback={filters([])}
        >
          {(result) => filters(result.categories ?? [])}
        </PublicContent>
      ) : (
        filters(page.categories)
      )}
      <div className="listing-area">
        <PublicContent
          content={content}
          cacheKey={cacheKey}
          fallback={<ContentSkeleton />}
        >
          {(result) => (
            <ListingResults
              kind={kind}
              items={result.data}
              meta={result.meta}
            />
          )}
        </PublicContent>
      </div>
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
function ListingResults({
  kind,
  items,
  meta,
}: {
  kind: ContentKind;
  items: ContentItem[];
  meta: ListResponse<ContentItem>['meta'];
}) {
  const [params] = useSearchParams();
  const page = copy[kind];
  const query = params.get('q') ?? '';
  const category =
    params.get('category') ?? (kind === 'information' ? 'Thông báo' : '');
  return (
    <>
      {items.length ? (
        <div className="article-list">
          {items.map((item, index) => (
            <ArticleCard key={item.id} item={item} priority={index === 0} />
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
    </>
  );
}
