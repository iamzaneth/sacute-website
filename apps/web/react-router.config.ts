import type { Config } from '@react-router/dev/config';
import { publicRoutes, localContent } from '@sacute/shared';

export default {
  ssr: false,
  prerender: [
    ...publicRoutes,
    ...new Set(
      Object.values(localContent)
        .flat()
        .map((item) => `/posts/${item.slug}`),
    ),
  ],
} satisfies Config;
