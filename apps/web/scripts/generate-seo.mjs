import { mkdir, writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';
import { pathToFileURL } from 'node:url';

export function validateOrigin(raw) {
  if (!raw) return undefined;
  const url = new URL(raw);
  if (
    url.protocol !== 'https:' ||
    url.origin !== raw.replace(/\/$/, '') ||
    url.username ||
    url.password ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    throw new Error(
      'VITE_SITE_ORIGIN must be a verified public HTTPS origin without a path',
    );
  return url.origin;
}
export function buildSeoFiles(env) {
  const origin = validateOrigin(env.VITE_SITE_ORIGIN?.trim());
  // Article URLs are discovered from runtime feeds, never enumerated at build time.
  const indexablePaths = ['/', '/information', '/scholarships', '/events'];
  const allow = Boolean(
    origin && env.VITE_ALLOW_INDEXING === 'true' && indexablePaths.length,
  );
  return {
    robots: allow
      ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
      : 'User-agent: *\nDisallow: /\n',
    sitemap: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${allow ? indexablePaths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join('') : ''}</urlset>\n`,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
  const files = buildSeoFiles(env);
  await mkdir('build/client', { recursive: true });
  await writeFile('build/client/robots.txt', files.robots);
  await writeFile('build/client/sitemap.xml', files.sitemap);
}
