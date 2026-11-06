import { mockContent } from './generated/mock-content';

export const organization = {
  shortName: 'SACUTE',
  name: 'Trung tâm Tư vấn và Hỗ trợ Sinh viên',
  institution: 'Trường Đại học Công nghệ Kỹ thuật TP.HCM',
  englishName: 'Student Assistance Center',
  email: 'sacute@hcmute.edu.vn',
  phone: null,
  address: 'Số 01, Võ Văn Ngân, P. Thủ Đức, TP. HCM',
  socialLinks: [
    { name: 'Facebook', url: 'https://www.facebook.com/hotrosinhvienspkt' },
    { name: 'TikTok', url: 'https://www.tiktok.com/@sacute.2015' },
  ],
  mapUrl: null,
} as const;

export const publicRoutes = [
  '/',
  '/information',
  '/scholarships',
  '/events',
  '/contact',
  '/recruitment',
] as const;
export type PublicPath = (typeof publicRoutes)[number];
export const navigation: readonly { path: PublicPath; label: string }[] = [
  { path: '/', label: 'Trang chủ' },
  { path: '/information', label: 'Thông tin' },
  { path: '/scholarships', label: 'Học bổng' },
  { path: '/events', label: 'Sự kiện nổi bật' },
  { path: '/contact', label: 'Liên hệ' },
  { path: '/recruitment', label: 'Tuyển thành viên' },
];

export interface PostImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}
export interface ContentItem {
  id: string;
  slug: string;
  title: string;
  originalTitle?: string;
  eventName?: string;
  summary: string;
  category: string;
  publishedAt?: string;
  content?: string;
  images?: readonly PostImage[];
  publishedAtPrecision?: 'date' | 'datetime';
  authorName?: string;
  authorUrl?: string;
  sourceUrl?: string;
  tags?: readonly string[];
}
export interface Information extends ContentItem {
  kind: 'information';
}
export interface Scholarship extends ContentItem {
  kind: 'scholarship';
  provider?: string;
  eligibility?: string;
  opensAt?: string;
  closesAt?: string;
  status: 'upcoming' | 'open' | 'closed';
}
export interface StudentEvent extends ContentItem {
  kind: 'event';
  startsAt?: string;
  startsOn?: string;
  endsOn?: string;
  location?: string;
  imageUrl?: string;
  status: 'upcoming' | 'ongoing' | 'ended';
}
export type ContentKind = 'information' | 'scholarships' | 'events';
export interface ContentMap {
  information: Information;
  scholarships: Scholarship;
  events: StudentEvent;
}
export interface ListQuery {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
}
export interface ListResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    source: 'local';
    contentStatus: 'pending-verification';
  };
}

// Prepared from apps/api/mock-data for the API and static prerendering.
export const localContent: { [K in ContentKind]: readonly ContentMap[K][] } = {
  ...mockContent,
  information: [
    ...mockContent.information,
    ...mockContent.events.map((item) => ({
      ...item,
      kind: 'information' as const,
      category: 'Hoạt động',
    })),
  ].sort(
    (a, b) =>
      Date.parse(b.publishedAt ?? '1970-01-01') -
      Date.parse(a.publishedAt ?? '1970-01-01'),
  ),
};

export function listContent<T extends ContentItem>(
  items: readonly T[],
  query: ListQuery = {},
): ListResponse<T> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 12;
  const search = query.q?.trim().toLocaleLowerCase('vi');
  const filtered = items.filter(
    (item) =>
      (!query.category || item.category === query.category) &&
      (!search ||
        `${item.title} ${item.summary}`
          .toLocaleLowerCase('vi')
          .includes(search)),
  );
  return {
    data: filtered.slice((page - 1) * limit, page * limit),
    meta: {
      total: filtered.length,
      page,
      limit,
      source: 'local',
      contentStatus: 'pending-verification',
    },
  };
}
