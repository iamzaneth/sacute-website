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
  width?: number;
  height?: number;
}
export interface ContentItem {
  id: string;
  slug: string;
  title: string;
  kind: 'information' | 'scholarship' | 'event';
  contentFormat?: 'plain-text' | 'markdown';
  coverImage?: PostImage;
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
  applicationUrl?: string;
  opensAt?: string;
  closesAt?: string;
  status: 'upcoming' | 'open' | 'closed';
}
export interface StudentEvent extends ContentItem {
  kind: 'event';
  startsAt?: string;
  endsAt?: string;
  registrationUrl?: string;
  startsOn?: string;
  endsOn?: string;
  location?: string;
  imageUrl?: string;
  status: 'upcoming' | 'ongoing' | 'ended';
}
export type ContentKind = 'information' | 'scholarships' | 'events';
export interface ContentMap {
  information: Information | StudentEvent;
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
    source: 'supabase';
  };
}

export * from './lifecycle';
