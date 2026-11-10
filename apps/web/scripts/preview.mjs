// Production SSR preview: serves assets and invokes the same React Router server build.
import express from 'express';
import { createRequestHandler } from '@react-router/express';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const bundles = (await readdir('build/server')).filter((name) =>
  name.startsWith('nodejs'),
);
if (bundles.length !== 1) throw new Error('Expected one Node SSR bundle');
const build = await import(
  pathToFileURL(resolve('build/server', bundles[0], 'index.js')).href
);
const app = express();
app.disable('x-powered-by');
app.use(
  express.static(resolve('build/client'), { index: false, redirect: false }),
);
app.use((request, response, next) => {
  if (
    /^\/(assets|branding|media)\//.test(request.path) &&
    !/^\/media\/posts\//.test(request.path)
  ) {
    response.status(404).end();
    return;
  }
  next();
});
app.use(createRequestHandler({ build, mode: 'production' }));
const server = app.listen(Number(process.env.PORT ?? 4173), '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
