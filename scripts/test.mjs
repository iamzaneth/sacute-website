// Keep deterministic SSR tests independent of checkout-local production SEO env.
// Normal `pnpm build` continues to honor the deployment's configured metadata.
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
async function run(command, args, env = process.env) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32' && command === 'pnpm',
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  if (code !== 0) process.exit(code);
}
await run('pnpm', ['build'], {
  ...process.env,
  VITE_SITE_ORIGIN: '',
  VITE_ALLOW_INDEXING: 'false',
});
const files = (
  await Promise.all(
    ['apps/api/test', 'tests'].map(async (directory) =>
      (await readdir(directory))
        .filter((file) => /\.test\.(cjs|mjs)$/.test(file))
        .map((file) => `${directory}/${file}`),
    ),
  )
)
  .flat()
  .sort();
await run(process.execPath, ['--experimental-strip-types', '--test', ...files]);
