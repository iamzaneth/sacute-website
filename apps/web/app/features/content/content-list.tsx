import { Form, useSearchParams } from 'react-router';
import { BookOpen, CalendarDays, GraduationCap, Search, X } from 'lucide-react';
import type { ContentItem, ContentKind } from '@sacute/shared';
import { EmptyState, PageIntro } from '../../components/ui';

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
    categories: ['Thông báo', 'Hỗ trợ sinh viên', 'Hoạt động'],
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
      'Không gian cập nhật các hoạt động sinh viên, chương trình cộng đồng và sự kiện từ SACUTE.',
    empty: 'Chưa có sự kiện được công bố',
    detail:
      'Lịch trình, địa điểm và hướng dẫn tham gia sẽ xuất hiện khi có thông tin chính thức. Hẹn gặp bạn ở những cập nhật sắp tới.',
    icon: CalendarDays,
    categories: ['Cộng đồng', 'Kỹ năng', 'Hỗ trợ sinh viên'],
  },
};
export function ContentList({
  kind,
  items,
}: {
  kind: ContentKind;
  items: ContentItem[];
}) {
  const page = copy[kind];
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const visible = items.filter(
    (item) =>
      (!category || item.category === category) &&
      `${item.title} ${item.summary}`
        .toLocaleLowerCase('vi')
        .includes(query.toLocaleLowerCase('vi')),
  );
  function selectCategory(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set('category', value);
    else next.delete('category');
    setParams(next, { preventScrollReset: true });
  }
  return (
    <div className="page">
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
            placeholder="Tìm kiếm nội dung…"
            maxLength={200}
          />
          {category && <input type="hidden" name="category" value={category} />}
          <button type="submit">Tìm kiếm</button>
        </Form>
        <span className="result-count" aria-live="polite">
          {visible.length} bài viết
        </span>
      </div>
      <div
        className="filter-tabs"
        role="group"
        aria-label="Lọc theo chuyên mục"
      >
        {['', ...page.categories].map((value) => (
          <button
            key={value}
            onClick={() => selectCategory(value)}
            aria-pressed={value === category}
            className={value === category ? 'selected' : ''}
          >
            {value || 'Tất cả'}
          </button>
        ))}
        {(query || category) && (
          <button className="clear-filters" onClick={() => setParams({})}>
            <X size={14} aria-hidden="true" />
            Xóa bộ lọc
          </button>
        )}
      </div>
      <div className="listing-area">
        {visible.length ? (
          <div className="article-list">
            {visible.map((item) => (
              <article key={item.id}>
                <p className="eyebrow">{item.category}</p>
                <h2>{item.title}</h2>
                {item.publishedAt && (
                  <time dateTime={item.publishedAt}>
                    {new Intl.DateTimeFormat('vi-VN', {
                      timeZone: 'Asia/Ho_Chi_Minh',
                    }).format(new Date(item.publishedAt))}
                  </time>
                )}
                <p>{item.summary}</p>
              </article>
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
      <aside className="information-note">
        <span className="tiny-dot" />
        <p>
          Chỉ những thông tin đã được xác nhận mới được công bố. Website hiện
          đang trong giai đoạn hoàn thiện nội dung.
        </p>
      </aside>
    </div>
  );
}
