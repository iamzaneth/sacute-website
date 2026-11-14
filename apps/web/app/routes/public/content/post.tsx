import { preload } from 'react-dom';
import { publicImageSource } from '~/services/content/image-cache';
import { Link, useLocation, isRouteErrorResponse } from 'react-router';
import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { contentHeaders } from '~/services/content/provider.server';
export const headers = contentHeaders;
import { loadPublicResult } from '~/services/content/public-content.server';
import {
  fetchPublicContent,
  peekPublicCache,
} from '~/services/content/public-cache';
import {
  publicResource,
  type PublicPayloads,
} from '~/features/content/data/public-data';
import { PublicContent } from '~/features/content/components/public-content';
import { ArticleCard } from '~/features/content/components/article-card';
import { pageMeta } from '~/lib/seo';
import type { Route } from './+types/post';

export async function loader({ request }: Route.LoaderArgs) {
  const result = await loadPublicResult(
    'post',
    new Request(new URL(publicResource('post', request.url), request.url)),
  );
  if (!result.ok)
    throw new Response(result.message, {
      status: result.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  return { ...result.value, etag: result.etag, validation: null };
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const cached = peekPublicCache<PublicPayloads['post']>(
    publicResource('post', request.url),
  );
  const validation = fetchPublicContent('post', request.url);
  if (cached) return { ...cached, etag: '', validation };
  const result = await validation;
  if (!result.ok) throw new Response(result.message, { status: result.status });
  return { ...result.value, etag: result.etag, validation: null };
}

export const meta: Route.MetaFunction = ({ data, error }) =>
  data
    ? [
        ...pageMeta(
          data.item.title,
          data.item.summary,
          `/posts/${data.item.slug}`,
          true,
        ),
        ...(data.item.coverImage
          ? [{ property: 'og:image', content: data.item.coverImage.url }]
          : []),
      ]
    : pageMeta(
        isRouteErrorResponse(error) && error.status === 404
          ? 'Không tìm thấy bài viết'
          : 'Không thể tải nội dung',
        'Vui lòng kiểm tra đường dẫn hoặc thử lại sau.',
        '/404',
        false,
      );

export default function Post({ loaderData }: Route.ComponentProps) {
  const firstImage = loaderData.item.images?.[0] ?? loaderData.item.coverImage;
  // React hoists this hint to the SSR head, before the gallery is parsed.
  if (typeof window === 'undefined' && firstImage)
    preload(publicImageSource(firstImage), {
      as: 'image',
      fetchPriority: 'high',
    });
  const location = useLocation();
  const content = useMemo(
    () =>
      loaderData.validation ?? {
        ok: true as const,
        value: { item: loaderData.item },
        etag: loaderData.etag,
      },
    [loaderData.validation, loaderData.item, loaderData.etag],
  );
  const requestedReturn = location.state?.returnTo;
  const returnTo =
    typeof requestedReturn === 'string' &&
    /^\/(events|information|scholarships)(\?|$)/.test(requestedReturn)
      ? requestedReturn
      : loaderData.item.kind === 'event'
        ? '/events'
        : loaderData.item.kind === 'scholarship'
          ? '/scholarships'
          : '/information';
  return (
    <div className="page post-detail-page">
      <Link className="text-link post-back-link" to={returnTo}>
        <ArrowLeft size={17} aria-hidden="true" />
        Quay lại danh sách
      </Link>
      <PublicContent
        cacheKey={publicResource('post', location.pathname)}
        content={content}
      >
        {({ item }) => <ArticleCard key={item.slug} item={item} detail />}
      </PublicContent>
    </div>
  );
}
