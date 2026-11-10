import { Suspense, lazy, useEffect } from 'react';
import { Link, useLocation, useNavigation, useRevalidator } from 'react-router';
// Pending navigation must not pull all page/gallery code into the root bundle.
const HomePage = lazy(() =>
  import('../home/home-page').then((m) => ({ default: m.HomePage })),
);
const ContentList = lazy(() =>
  import('./content-list').then((m) => ({ default: m.ContentList })),
);
const ArticleCard = lazy(() =>
  import('./article-card').then((m) => ({ default: m.ArticleCard })),
);
import type { PublicPayloads } from './public-data';
import { ContentSkeleton } from './content-skeleton';
import { publicResource } from './public-data';
import {
  clearPublicCache,
  peekPublicCache,
} from '../../services/public-content-cache';

export function NavigationSkeleton({ url }: { url: string }) {
  return (
    <Suspense
      fallback={
        <div className="page">
          <ContentSkeleton />
        </div>
      }
    >
      <DestinationSkeleton url={url} />
    </Suspense>
  );
}
function DestinationSkeleton({ url }: { url: string }) {
  const path = new URL(url, 'http://route.local').pathname;
  if (path === '/')
    return <HomePage content={null} cacheKey={publicResource('home', url)} />;
  if (
    path === '/information' ||
    path === '/events' ||
    path === '/scholarships'
  ) {
    const kind = path.slice(1) as 'information' | 'events' | 'scholarships';
    return (
      <ContentList
        kind={kind}
        content={null}
        cacheKey={publicResource(kind, url)}
      />
    );
  }
  const cached = path.startsWith('/posts/')
    ? peekPublicCache<PublicPayloads['post']>(publicResource('post', url))
    : undefined;
  return (
    <div className="page post-detail-page">
      <Link className="text-link post-back-link" to="/information">
        Quay lại danh sách
      </Link>
      {cached ? (
        <ArticleCard item={cached.item} detail />
      ) : (
        <ContentSkeleton count={1} label="Đang tải nội dung trang…" />
      )}
    </div>
  );
}
export function usePublicFreshness() {
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  useEffect(() => {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      clearPublicCache();
      return;
    }
    if (
      !['/', '/information', '/scholarships', '/events'].includes(pathname) &&
      !pathname.startsWith('/posts/')
    )
      return;
    let lastCheck = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (
        document.visibilityState !== 'visible' ||
        navigation.state !== 'idle' ||
        revalidator.state !== 'idle'
      )
        return;
      const remaining = 2000 - (Date.now() - lastCheck);
      if (remaining > 0) {
        clearTimeout(timer);
        timer = setTimeout(refresh, remaining);
        return;
      }
      lastCheck = Date.now();
      void revalidator.revalidate();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [pathname, navigation.state, revalidator]);
}
