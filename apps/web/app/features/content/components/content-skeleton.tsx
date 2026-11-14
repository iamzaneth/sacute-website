export function ContentSkeleton({
  count = 3,
  compact = false,
  rows = false,
  label = 'Đang tải bài viết…',
}: {
  count?: number;
  compact?: boolean;
  rows?: boolean;
  label?: string;
}) {
  return (
    <div
      className={`content-skeleton${compact ? ' compact' : ''}${rows ? ' rows' : ''}`}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="skeleton-list">
        {Array.from({ length: count }, (_, index) => (
          <div className="skeleton-card" key={index}>
            <div className="skeleton-block skeleton-picture" />
            <div className="skeleton-copy">
              <div className="skeleton-block skeleton-caption" />
              <div className="skeleton-block skeleton-heading" />
              <div className="skeleton-block skeleton-line" />
              <div className="skeleton-block skeleton-line short" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function InlineSkeleton() {
  return <span className="skeleton-block skeleton-inline" aria-hidden="true" />;
}
