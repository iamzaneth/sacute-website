import type { Config } from '@react-router/dev/config';
import { publicRoutes } from '@sacute/shared';
import { readdir, readFile } from 'node:fs/promises';

export default {
  ssr: false,
  async prerender() {
    // Read current source metadata rather than a cached compiled shared module.
    // The app uses shared source through Vite, while this config runs in Node.
    const paths = new Set<string>(publicRoutes);
    for (const collection of ['events', 'information', 'scholarships']) {
      const directory = new URL(
        `../api/mock-data/posts/${collection}/`,
        import.meta.url,
      );
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const metadata = JSON.parse(
          await readFile(
            new URL(`${entry.name}/metadata.json`, directory),
            'utf8',
          ),
        );
        if (metadata.publicationStatus === 'published')
          paths.add(`/posts/${metadata.slug}`);
      }
    }
    return [...paths];
  },
} satisfies Config;
