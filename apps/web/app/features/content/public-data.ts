import type { ContentItem, ListResponse } from '@sacute/shared';
import type { PublicPost } from '@sacute/shared/content';

export interface PublicPayloads {
  home: {
    information: ContentItem[];
    scholarships: ContentItem[];
    events: ContentItem[];
  };
  information: ListResponse<ContentItem>;
  scholarships: ListResponse<ContentItem>;
  events: ListResponse<ContentItem> & { categories: string[] };
  post: { item: PublicPost };
}
export type PublicView = keyof PublicPayloads;
export type PublicResult<T> =
  | { ok: true; value: T; etag: string }
  | { ok: false; message: string; status: number };

export type PublicData<T> = PublicResult<T> | Promise<PublicResult<T>>;

// One normalized key for SSR priming, navigation, search and browser history.
export function publicResource(view: PublicView, routeURL: string) {
  const url = new URL(routeURL, 'http://route.local');
  const params = new URLSearchParams({ view });
  if (view === 'post')
    params.set(
      'slug',
      decodeURIComponent(url.pathname.slice('/posts/'.length)),
    );
  else if (view !== 'home') {
    params.set('page', url.searchParams.get('page') ?? '1');
    params.set('q', url.searchParams.get('q') ?? '');
    params.set(
      'category',
      url.searchParams.get('category') ??
        (view === 'information' ? 'Thông báo' : ''),
    );
  }
  return `/resources/content?${params}`;
}
