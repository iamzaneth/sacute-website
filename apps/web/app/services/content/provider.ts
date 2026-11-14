import type {
  ContentKind,
  ContentMap,
  ListQuery,
  ListResponse,
} from '@sacute/shared';
export interface ContentProvider {
  list<K extends ContentKind>(
    kind: K,
    query?: ListQuery,
  ): Promise<ListResponse<ContentMap[K]>>;
}
