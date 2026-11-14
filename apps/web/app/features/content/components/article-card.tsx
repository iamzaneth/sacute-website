import { useId, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import type { ContentItem } from '@sacute/shared';
import { centerProfile } from '~/components/layout/brand';
import { PostGallery } from './post-gallery';
import { prefetchPublicContent } from '~/services/content/public-cache';

function LinkedText({ text }: { text: string }) {
  return text
    .split(/(https:\/\/[^\s]+|[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,})/g)
    .map((part, index) =>
      part.startsWith('https://') ? (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      ) : /^[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(part) ? (
        <a key={index} href={`mailto:${part}`}>
          {part}
        </a>
      ) : (
        part
      ),
    );
}

function PostBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const characters = Array.from(text);
  const firstLines = text.split('\n').slice(0, 6).join('\n');
  const limit = Math.min(500, Array.from(firstLines).length);
  const canExpand = characters.length > limit;
  let excerpt = characters.slice(0, limit).join('');
  // Keep the last word (including long URLs) whole when possible.
  if (canExpand && /\S/.test(characters[limit] ?? '')) {
    const lastSpace = excerpt.search(/\s+\S*$/u);
    if (lastSpace > 0) excerpt = excerpt.slice(0, lastSpace);
  }
  const visibleText = canExpand && !expanded ? `${excerpt.trimEnd()}…` : text;

  return (
    <>
      <div className="article-body" id={contentId}>
        {visibleText.split(/\n\n+/).map((paragraph, index) => (
          <p key={index}>
            <LinkedText text={paragraph} />
          </p>
        ))}
      </div>
      {canExpand && (
        <button
          type="button"
          className="post-text-toggle"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Ẩn bớt' : 'Xem thêm'}
        </button>
      )}
    </>
  );
}

function PublishedDate({ item }: { item: ContentItem }) {
  if (!item.publishedAt) return null;
  const dateOnly =
    item.publishedAtPrecision === 'date' ||
    /^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt);
  return (
    <time dateTime={item.publishedAt}>
      {new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit' }),
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(
        new Date(
          dateOnly ? `${item.publishedAt}T00:00:00+07:00` : item.publishedAt,
        ),
      )}
    </time>
  );
}

export function ArticleCard({
  item,
  preview = false,
  detail = false,
  priority = false,
}: {
  item: ContentItem;
  preview?: boolean;
  detail?: boolean;
  priority?: boolean;
}) {
  const thumbnail = item.coverImage ?? item.images?.[0];
  const titleId = useId();
  const location = useLocation();
  const Heading = detail ? 'h1' : preview ? 'h3' : 'h2';
  let body = item.content ?? item.summary;
  if (item.originalTitle && body.startsWith(item.originalTitle))
    body = body.slice(item.originalTitle.length).trimStart();
  if (!detail)
    return (
      <article
        className="article-card post-summary"
        id={preview ? undefined : item.slug}
      >
        <Link
          className="post-card-link"
          to={`/posts/${item.slug}`}
          state={{ returnTo: `${location.pathname}${location.search}` }}
          aria-labelledby={titleId}
          prefetch="intent"
          onPointerEnter={() =>
            prefetchPublicContent('post', `/posts/${item.slug}`)
          }
          onFocus={() => prefetchPublicContent('post', `/posts/${item.slug}`)}
          onTouchStart={() =>
            prefetchPublicContent('post', `/posts/${item.slug}`)
          }
        >
          {thumbnail && (
            <div className="post-thumbnail">
              <img
                src={thumbnail.thumbnailUrl ?? thumbnail.url}
                srcSet={
                  thumbnail.thumbnailUrl
                    ? `${thumbnail.thumbnailUrl.replace('width=640', 'width=320')} 320w, ${thumbnail.thumbnailUrl} 640w`
                    : undefined
                }
                sizes="(max-width: 600px) 100vw, 360px"
                decoding="async"
                fetchPriority={priority ? 'high' : undefined}
                onError={(event) => {
                  if (event.currentTarget.getAttribute('src') === thumbnail.url)
                    return;
                  event.currentTarget.removeAttribute('srcset');
                  event.currentTarget.src = thumbnail.url;
                }}
                alt={thumbnail.alt}
                width={thumbnail.width}
                height={thumbnail.height}
                loading={priority ? 'eager' : 'lazy'}
              />
            </div>
          )}
          <div className="post-card-copy">
            <p className="post-event-name">{item.eventName ?? item.category}</p>
            <Heading id={titleId}>{item.title}</Heading>
            <p className="post-excerpt">{item.summary}</p>
            <div className="post-card-bottom">
              <PublishedDate item={item} />
            </div>
          </div>
        </Link>
      </article>
    );
  return (
    <article className="article-card post-detail" id={item.slug}>
      <header className="post-header">
        <img
          className="post-avatar"
          src={centerProfile.avatar.src}
          alt=""
          width={44}
          height={44}
        />
        <div>
          {item.authorUrl ? (
            <a
              className="post-author"
              href={item.authorUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.authorName ?? 'SACUTE'}
            </a>
          ) : (
            <span className="post-author">{item.authorName ?? 'SACUTE'}</span>
          )}
          <div className="article-meta">
            <PublishedDate item={item} />
            <span aria-hidden="true">·</span>
            {item.sourceUrl ? (
              <a
                className="post-source"
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Xem bài gốc trên Facebook"
                title="Xem bài gốc trên Facebook"
              >
                Bài gốc <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            ) : (
              <span>Facebook</span>
            )}
          </div>
        </div>
      </header>
      <div className="post-caption">
        <p className="post-event-name">{item.eventName ?? item.category}</p>
        <Heading>{item.title}</Heading>
        <PostBody key={`${item.slug}:${body}`} text={body} />
      </div>
      <PostGallery images={item.images ?? []} title={item.title} />
    </article>
  );
}
