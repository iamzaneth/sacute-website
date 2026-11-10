import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicSupabaseClient,
  SupabaseContentRepository,
} from '@sacute/shared/content';
import type { PublicPost } from '@sacute/shared/content';
import type {
  ContentKind,
  ContentMap,
  ListQuery,
  ListResponse,
} from '@sacute/shared';
export abstract class ContentRepository {
  abstract list<K extends ContentKind>(
    kind: K,
    query: ListQuery,
  ): Promise<ListResponse<ContentMap[K]>>;
  abstract getPostBySlug(slug: string): Promise<PublicPost | null>;
  abstract readPublicMedia(
    postId: string,
    mediaId: string,
  ): Promise<Blob | null>;
}
@Injectable()
export class CloudContentRepository extends ContentRepository {
  private readonly store: SupabaseContentRepository;
  constructor(config: ConfigService) {
    super();
    this.store = new SupabaseContentRepository(
      createPublicSupabaseClient({
        SUPABASE_URL: config.get('SUPABASE_URL'),
        SUPABASE_PUBLISHABLE_KEY: config.get('SUPABASE_PUBLISHABLE_KEY'),
      }),
      undefined,
      '/api/v1/media/posts',
    );
  }
  list<K extends ContentKind>(kind: K, query: ListQuery) {
    return this.store.list(kind, query);
  }
  getPostBySlug(slug: string) {
    return this.store.getPostBySlug(slug);
  }
  readPublicMedia(postId: string, mediaId: string) {
    return this.store.readPublicMedia(postId, mediaId);
  }
}
