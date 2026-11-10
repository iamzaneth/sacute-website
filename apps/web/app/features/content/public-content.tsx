import { Suspense, useEffect, type ReactNode } from 'react';
import { Await, useRevalidator } from 'react-router';
import type { PublicResult, PublicData } from './public-data';
import {
  primePublicCache,
  peekPublicCache,
} from '../../services/public-content-cache';
import { ContentSkeleton } from './content-skeleton';

function VerifiedContent<T>({
  result,
  cacheKey,
  children,
}: {
  result: Extract<PublicResult<T>, { ok: true }>;
  cacheKey: string;
  children: (value: T) => ReactNode;
}) {
  useEffect(() => {
    primePublicCache(cacheKey, result.value, result.etag);
  }, [cacheKey, result]);
  return children(result.value);
}
export function ContentLoadError({
  message = 'Không thể tải nội dung. Vui lòng thử lại sau.',
}: {
  message?: string;
}) {
  const revalidator = useRevalidator();
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
  const cached = peekPublicCache<T>(cacheKey);
  const pending =
    cached === undefined ? (
      fallback
    ) : (
      <>
        {children(cached)}
        <span className="sr-only" role="status">
          Đang kiểm tra cập nhật…
        </span>
      </>
    );
  if (content === null) return pending;
  if ('ok' in content)
    return content.ok ? (
      <VerifiedContent result={content} cacheKey={cacheKey}>
        {children}
      </VerifiedContent>
    ) : (
      (errorFallback ?? <ContentLoadError message={content.message} />)
    );
  return (
    <Suspense key={cacheKey} fallback={pending}>
      <Await
        resolve={content}
        errorElement={errorFallback ?? <ContentLoadError />}
      >
        {(result: PublicResult<T>) =>
          result.ok ? (
            <VerifiedContent result={result} cacheKey={cacheKey}>
              {children}
            </VerifiedContent>
          ) : (
            (errorFallback ?? <ContentLoadError message={result.message} />)
          )
        }
      </Await>
    </Suspense>
  );
}
