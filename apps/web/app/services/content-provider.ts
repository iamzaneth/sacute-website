import {
  localContent,
  listContent,
  type ContentKind,
  type ContentMap,
  type ListQuery,
  type ListResponse,
} from '@sacute/shared';

export interface ContentProvider {
  list<K extends ContentKind>(
    kind: K,
    query?: ListQuery,
  ): Promise<ListResponse<ContentMap[K]>>;
}
export const contentProvider: ContentProvider = {
  async list<K extends ContentKind>(kind: K, query: ListQuery = {}) {
    return listContent<ContentMap[K]>(localContent[kind], query);
  },
};
