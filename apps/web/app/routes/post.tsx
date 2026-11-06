import { Link, useLocation } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { localContent } from '@sacute/shared';
import { ArticleCard } from '../features/content/article-card';
import { pageMeta } from '../lib/seo';
import type { Route } from './+types/post';

export function loader({ params }: Route.LoaderArgs) {
  const item = [
    ...localContent.events,
    ...localContent.information,
    ...localContent.scholarships,
  ].find((post) => post.slug === params.slug);
  if (!item) throw new Response('Không tìm thấy bài viết', { status: 404 });
  return { item };
}

export const meta: Route.MetaFunction = ({ data }) =>
  data
    ? pageMeta(data.item.title, data.item.summary, `/posts/${data.item.slug}`)
    : pageMeta(
        'Không tìm thấy bài viết',
        'Bài viết bạn đang tìm không tồn tại.',
        '/404',
      );

export default function Post({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  const requestedReturn = location.state?.returnTo;
  const returnTo =
    typeof requestedReturn === 'string' &&
    /^\/(events|information|scholarships)(\?|$)/.test(requestedReturn)
      ? requestedReturn
      : loaderData.item.eventName
        ? '/events'
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
