import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    alias: [
      {
        find: '@sacute/shared/content',
        replacement: fileURLToPath(
          new URL('../../packages/shared/src/content.ts', import.meta.url),
        ),
      },
      {
        find: '@sacute/shared',
        replacement: fileURLToPath(
          new URL('../../packages/shared/src/index.ts', import.meta.url),
        ),
      },
    ],
  },
});
