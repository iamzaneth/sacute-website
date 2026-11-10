import { Link, useLocation, isRouteErrorResponse } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import {
  readContent,
  contentHeaders,
} from '../services/content-provider.server';
export const headers = contentHeaders;
import { fetchPublicContent } from '../services/public-content-cache';
import { ArticleCard } from '../features/content/article-card';
import { pageMeta } from '../lib/seo';
import type { Route } from './+types/post';

export async function loader({ params }: Route.LoaderArgs) {
  return readContent(async (repository) => {
    const item = await repository.getPostBySlug(params.slug);
    if (!item)
      throw new Response('Không tìm thấy bài viết', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    return { item };
  });
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const result = await fetchPublicContent('post', request.url);
  if (!result.ok) throw new Response(result.message, { status: result.status });
  return result.value;
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
  const location = useLocation();
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
      <ArticleCard item={loaderData.item} detail />
    </div>
  );
}
