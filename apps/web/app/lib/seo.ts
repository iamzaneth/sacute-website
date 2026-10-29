import type { MetaDescriptor } from 'react-router';
import { siteConfig } from './site-config';

export function pageMeta(
  title: string,
  description: string,
  path: string,
  verified = false,
): MetaDescriptor[] {
  const fullTitle = `${title} | SACUTE`;
  const canonical = siteConfig.origin
    ? `${siteConfig.origin}${path}`
    : undefined;
  return [
    { title: fullTitle },
    { name: 'description', content: description },
    {
      name: 'robots',
      content:
        verified && siteConfig.allowIndexing && canonical
          ? 'index, follow'
          : 'noindex, nofollow',
    },
    { property: 'og:title', content: fullTitle },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'vi_VN' },
    { property: 'og:site_name', content: 'SACUTE' },
    ...(canonical
      ? [
          { tagName: 'link', rel: 'canonical', href: canonical },
          { property: 'og:url', content: canonical },
        ]
      : []),
  ];
}
