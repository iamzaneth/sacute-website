import { Injectable } from '@nestjs/common';
import {
  localContent,
  listContent,
  type ContentKind,
  type ContentMap,
  type ListQuery,
  type ListResponse,
} from '@sacute/shared';

export abstract class ContentRepository {
  abstract list<K extends ContentKind>(
    kind: K,
    query: ListQuery,
  ): Promise<ListResponse<ContentMap[K]>>;
}

@Injectable()
export class LocalContentRepository extends ContentRepository {
  async list<K extends ContentKind>(
    kind: K,
    query: ListQuery,
  ): Promise<ListResponse<ContentMap[K]>> {
    return listContent<ContentMap[K]>(localContent[kind], query);
  }
}
