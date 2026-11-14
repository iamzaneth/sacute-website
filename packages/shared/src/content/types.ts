export interface PostImage {
  thumbnailUrl?: string;
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
