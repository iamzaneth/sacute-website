import { contentChangedEvent } from './use-content-invalidation';
import { useEffect } from 'react';
import { useLocation, useNavigation, useRevalidator } from 'react-router';
import { publicResource } from '~/features/content/data/public-data';
import {
  clearPublicCache,
  isPublicCacheFresh,
} from '~/services/content/public-cache';

export function usePublicFreshness() {
  const { pathname, search } = useLocation();
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
    const view = pathname.startsWith('/posts/')
      ? 'post'
      : pathname === '/'
        ? 'home'
        : (pathname.slice(1) as 'information' | 'scholarships' | 'events');
    const key = publicResource(view, pathname + search);
    const refresh = () => {
      if (
        document.visibilityState !== 'visible' ||
        navigation.state !== 'idle' ||
        revalidator.state !== 'idle' ||
        isPublicCacheFresh(key)
      )
        return;
      void revalidator.revalidate();
    };
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener(contentChangedEvent, refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(contentChangedEvent, refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [pathname, search, navigation.state, revalidator]);
}
