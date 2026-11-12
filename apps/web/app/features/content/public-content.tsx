import { Suspense, use, useEffect, useState, type ReactNode } from 'react';
import { useRevalidator } from 'react-router';
import type { PublicResult, PublicData } from './public-data';
import {
  primePublicCache,
  peekPublicCache,
} from '../../services/public-content-cache';
import { ContentSkeleton } from './content-skeleton';
import { useToastFeedback } from '../../components/toast/toast';

function VerifiedContent<T>({
  result,
  cacheKey,
  children,
  verified = true,
}: {
  result: Extract<PublicResult<T>, { ok: true }>;
  cacheKey: string;
  children: (value: T) => ReactNode;
  verified?: boolean;
}) {
  useEffect(() => {
    if (verified) primePublicCache(cacheKey, result.value, result.etag);
  }, [cacheKey, result, verified]);
  return children(result.value);
}
export function ContentLoadError({
  message = 'Không thể tải nội dung. Vui lòng thử lại sau.',
}: {
  message?: string;
}) {
  const revalidator = useRevalidator();
  useToastFeedback(message, message, 'error');
  return (
    <div className="content-load-error" role="alert">
      <p>{message}</p>
      <button
        type="button"
        className="button button-secondary"
        onClick={() => void revalidator.revalidate()}
        disabled={revalidator.state !== 'idle'}
      >
        {revalidator.state === 'idle' ? 'Thử tải lại' : 'Đang thử lại…'}
      </button>
    </div>
  );
}
export function PublicContent<T>({
  content,
  cacheKey,
  children,
  fallback = <ContentSkeleton />,
  errorFallback,
}: {
  content: PublicData<T> | null;
  cacheKey: string;
  children: (value: T) => ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <ContentValue
        content={content}
        cacheKey={cacheKey}
        fallback={fallback}
        errorFallback={errorFallback}
      >
        {children}
      </ContentValue>
    </Suspense>
  );
}

function ContentValue<T>({
  content,
  cacheKey,
  children,
  fallback,
  errorFallback,
}: {
  content: PublicData<T> | null;
  cacheKey: string;
  children: (value: T) => ReactNode;
  fallback: ReactNode;
  errorFallback?: ReactNode;
}) {
  const [settled, setSettled] = useState<{
    source: PublicData<T>;
    result: PublicResult<T>;
  } | null>(null);
  useEffect(() => {
    if (!content || 'ok' in content) return;
    let active = true;
    void content.then((result) => {
      if (active) setSettled({ source: content, result });
    });
    return () => {
      active = false;
    };
  }, [content]);

  const cached = peekPublicCache<T>(cacheKey);
  let result =
    content && 'ok' in content
      ? content
      : settled?.source === content
        ? settled.result
        : undefined;
  // A cached value and its validated replacement share the same React tree.
  // Revalidation must not remount an expanded caption or an open gallery.
  let verified = result !== undefined;
  if (!result && cached !== undefined)
    result = { ok: true, value: cached, etag: '' };
  if (!result && content && !('ok' in content)) {
    result = use(content);
    verified = true;
  }
  if (!result) return fallback;
  if (!result.ok)
    return errorFallback ?? <ContentLoadError message={result.message} />;
  return (
    <VerifiedContent result={result} cacheKey={cacheKey} verified={verified}>
      {children}
    </VerifiedContent>
  );
}
