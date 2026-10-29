import type {
  ContentKind,
  ContentMap,
  ListQuery,
  ListResponse,
} from '@sacute/shared';
import type { ContentProvider } from './content-provider';

// Opt-in browser adapter. Prerendering intentionally uses the local provider.
export function createApiContentProvider(baseUrl: string): ContentProvider {
  return {
    async list<K extends ContentKind>(
      kind: K,
      query: ListQuery = {},
    ): Promise<ListResponse<ContentMap[K]>> {
      const url = new URL(`${baseUrl.replace(/\/$/, '')}/${kind}`);
      for (const [key, value] of Object.entries(query))
        if (value !== undefined) url.searchParams.set(key, String(value));
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok)
        throw new Error('Không thể tải nội dung. Vui lòng thử lại sau.');
      return response.json();
    },
  };
}
