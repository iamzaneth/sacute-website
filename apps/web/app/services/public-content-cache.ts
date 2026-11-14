import { clearPublicImages, warmPublicImage } from './public-image-cache';
import type { ContentItem, ListResponse } from '@sacute/shared';
import type {
  PublicPayloads,
  PublicView,
  PublicResult,
} from '../features/content/public-data';
import { publicResource } from '../features/content/public-data';

type Entry = { value: unknown; etag: string; size: number; stored: number };
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<PublicResult<unknown>>>();
const maxEntries = 16,
  maxBytes = 4 * 1024 * 1024,
  retention = 5 * 60 * 1000;
const freshness = 60 * 1000;
let bytes = 0,
  generation = 0;
function remove(key: string) {
  bytes -= entries.get(key)?.size ?? 0;
  entries.delete(key);
}
export function clearPublicCache() {
  clearPublicImages();
  generation++;
  entries.clear();
  bytes = 0;
  pending.clear();
}
export function primePublicCache(key: string, value: unknown, etag: string) {
  if (typeof window === 'undefined') return;
  if (entries.get(key)?.etag && entries.get(key)?.etag !== etag)
    clearPublicImages();
  storeEntry(key, value, etag, Date.now());
}

function storeEntry(key: string, value: unknown, etag: string, stored: number) {
  const same = entries.get(key);
  if (same && same.value === value && same.etag === etag) {
    entries.delete(key);
    // Rendering or reading a snapshot must not extend its freshness window.
    entries.set(key, same);
    return;
  }
  const size = JSON.stringify(value).length * 2;
  remove(key);
  if (size > maxBytes) return;
  entries.set(key, { value, etag, size, stored });
  bytes += size;
  while (entries.size > maxEntries || bytes > maxBytes)
    remove(entries.keys().next().value!);
}

function postSnapshot(slug: string | null) {
  for (const entry of [...entries.values()].reverse()) {
    if (Date.now() - entry.stored > retention) continue;
    const payload = entry.value as Record<string, unknown>;
    for (const group of [
      payload.data,
      payload.information,
      payload.scholarships,
      payload.events,
    ]) {
      if (!Array.isArray(group)) continue;
      const item = group.find(
        (item) => item.slug === slug && typeof item.content === 'string',
      );
      if (item)
        return {
          value: { item } as PublicPayloads['post'],
          stored: entry.stored,
        };
    }
  }
}

function invalidatePost(slug: string | null) {
  clearPublicImages();
  // A rejected detail must not be resurrected from an older list snapshot.
  for (const [key, entry] of entries) {
    const value = entry.value as Record<string, unknown>;
    if (
      (value.item as ContentItem | undefined)?.slug === slug ||
      [value.data, value.information, value.scholarships, value.events].some(
        (group) =>
          Array.isArray(group) && group.some((item) => item.slug === slug),
      )
    )
      remove(key);
  }
}

export function isPublicCacheFresh(key: string) {
  const entry = entries.get(key);
  return !!entry && Date.now() - entry.stored < freshness;
}

// Previously public snapshots are presentation hints while a fresh read runs.
// Legacy full-article snapshots can seed detail; summary-only lists cannot.
export function peekPublicCache<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined;
  const cached = entries.get(key);
  if (cached && Date.now() - cached.stored <= retention)
    return cached.value as T;
  const params = new URL(key, window.location.origin).searchParams;
  if (
    ['information', 'scholarships', 'events'].includes(
      params.get('view') ?? '',
    ) &&
    params.get('page') === '1'
  ) {
    for (const [sourceKey, entry] of [...entries.entries()].reverse()) {
      if (Date.now() - entry.stored > retention) continue;
      const source = new URL(sourceKey, window.location.origin).searchParams;
      if (
        source.get('view') !== params.get('view') ||
        (source.get('q') && source.get('q') !== params.get('q')) ||
        (source.get('category') &&
          source.get('category') !== params.get('category'))
      )
        continue;
      const value = entry.value as ListResponse<ContentItem> & {
        categories?: string[];
      };
      if (!Array.isArray(value.data) || value.data.length !== value.meta?.total)
        continue;
      const query = (params.get('q') ?? '').trim().toLocaleLowerCase('vi');
      const category = params.get('category');
      const data = value.data.filter(
        (item) =>
          (!category ||
            (params.get('view') === 'events'
              ? (item.eventName ?? item.category)
              : item.category) === category) &&
          (!query ||
            item.title.toLocaleLowerCase('vi').includes(query) ||
            item.summary.toLocaleLowerCase('vi').includes(query)),
      );
      return {
        ...value,
        data,
        meta: { ...value.meta, total: data.length, page: 1 },
      } as T;
    }
  }
  if (params.get('view') !== 'post') return undefined;
  return postSnapshot(params.get('slug'))?.value as T | undefined;
}

// Warm the first visible images as soon as data arrives, including list/home
// intent prefetch. Waiting for a post-detail hover misses normal sidebar navigation.
function warmContentImages(view: PublicView, value: unknown) {
  if (view === 'post') {
    const item = (value as Partial<PublicPayloads['post']>).item;
    if (item) warmPublicImage(item.images?.[0] ?? item.coverImage);
    return;
  }
  if (view === 'home') {
    const payload = value as Partial<PublicPayloads['home']>;
    for (const item of [
      payload.information?.[0],
      payload.scholarships?.[0],
      payload.events?.[0],
    ]
      .filter(Boolean)
      .slice(0, 2))
      warmPublicImage(item?.coverImage ?? item?.images?.[0]);
    return;
  }
  const payload = value as Partial<PublicPayloads['information']>;
  if (Array.isArray(payload.data))
    for (const item of payload.data.slice(0, 2))
      warmPublicImage(item.coverImage ?? item.images?.[0]);
}

export function fetchPublicContent<K extends PublicView>(
  view: K,
  routeURL: string,
): Promise<PublicResult<PublicPayloads[K]>> {
  const key = publicResource(view, routeURL);
  const existing = pending.get(key);
  if (existing) return existing as Promise<PublicResult<PublicPayloads[K]>>;
  if (view === 'post' && !entries.has(key)) {
    const snapshot = postSnapshot(
      new URL(key, routeURL).searchParams.get('slug'),
    );
    // List reads already verified this full article. Inherit their timestamp,
    // never start a new freshness window just because the reader opened it.
    if (snapshot) storeEntry(key, snapshot.value, '', snapshot.stored);
  }
  const fresh = entries.get(key);
  if (fresh && isPublicCacheFresh(key)) {
    entries.delete(key);
    entries.set(key, fresh);
    return Promise.resolve({
      ok: true,
      value: fresh.value as PublicPayloads[K],
      etag: fresh.etag,
    });
  }
  const currentGeneration = generation;
  const job = (async (): Promise<PublicResult<unknown>> => {
    let cached = entries.get(key);
    if (cached && Date.now() - cached.stored > retention) {
      remove(key);
      cached = undefined;
    }
    try {
      // Validate current DB visibility in the background. The UI may preview a
      // prior public snapshot; failed validation never becomes offline success.
      // No localStorage, service worker or shared HTTP/CDN data cache.
      const response = await fetch(key, {
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(12000),
        headers: cached?.etag ? { 'If-None-Match': cached.etag } : {},
      });
      if (currentGeneration !== generation)
        return {
          ok: false,
          status: 409,
          message: 'Nội dung đang được cập nhật. Vui lòng thử lại.',
        };
      if (response.status === 304 && cached) {
        // Only a successful server check renews freshness.
        remove(key);
        primePublicCache(key, cached.value, cached.etag);
        return { ok: true, value: cached.value, etag: cached.etag };
      }
      if (!response.ok) {
        remove(key);
        if (view === 'post' && response.status === 404)
          invalidatePost(new URL(key, routeURL).searchParams.get('slug'));
        return {
          ok: false,
          status: response.status,
          message:
            response.status === 404
              ? 'Không tìm thấy bài viết.'
              : response.status === 400
                ? 'Bộ lọc không hợp lệ.'
                : 'Không thể tải nội dung. Vui lòng thử lại sau.',
        };
      }
      const etag = response.headers.get('ETag');
      if (!etag) throw Error('Missing validation tag');
      const value: unknown = await response.json();
      if (currentGeneration !== generation)
        return {
          ok: false,
          status: 409,
          message: 'Nội dung đang được cập nhật. Vui lòng thử lại.',
        };
      primePublicCache(key, value, etag);
      warmContentImages(view, value);
      return { ok: true, value, etag };
    } catch {
      if (currentGeneration === generation) remove(key);
      return {
        ok: false,
        status: 503,
        message: 'Không thể tải nội dung. Kiểm tra kết nối và thử lại.',
      };
    }
  })();
  // Navigation cancellation does not poison a request shared by another tab
  // navigation. It can warm only this bounded public cache, never an admin cache.
  pending.set(key, job);
  void job.finally(() => {
    if (pending.get(key) === job) pending.delete(key);
  });
  return job as Promise<PublicResult<PublicPayloads[K]>>;
}

export function prefetchPublicContent(view: PublicView, routeURL: string) {
  if (pending.size >= 3) return;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (
    connection?.saveData ||
    ['slow-2g', '2g'].includes(connection?.effectiveType ?? '')
  )
    return;
  void fetchPublicContent(
    view,
    new URL(routeURL, window.location.origin).href,
  ).then((result) => {
    if (result.ok) warmContentImages(view, result.value);
  });
}
