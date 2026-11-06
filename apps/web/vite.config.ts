import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    {
      name: 'refresh-content-prerender-paths',
      async handleHotUpdate({ file, server }) {
        // React Router captures prerender paths at startup. HMR alone refreshes
        // cards but leaves new post .data requests returning 404 in SPA mode.
        if (
          file ===
          fileURLToPath(
            new URL(
              '../../packages/shared/src/generated/mock-content.ts',
              import.meta.url,
            ),
          )
        ) {
          await server.restart();
          return [];
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@sacute/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
});
