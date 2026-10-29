import { organization } from '@sacute/shared';

const rawOrigin = import.meta.env.VITE_SITE_ORIGIN?.trim();
export const siteOrigin = rawOrigin ? new URL(rawOrigin).origin : undefined;
export const siteConfig = {
  organization,
  origin: siteOrigin,
  allowIndexing: import.meta.env.VITE_ALLOW_INDEXING === 'true',
};
