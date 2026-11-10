import { spawn } from 'node:child_process';
import { startFixtureDatabase, testKey } from './supabase.mjs';
const database = await startFixtureDatabase(54329);
const child = spawn(process.execPath, ['scripts/preview.mjs'], {
  cwd: 'apps/web',
  env: {
    ...process.env,
    SUPABASE_URL: database.url,
    SUPABASE_PUBLISHABLE_KEY: testKey,
  },
  stdio: 'inherit',
});
async function close() {
  child.kill('SIGTERM');
  await database.close();
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
child.on('exit', async (code) => {
  await database.close();
  process.exit(code ?? 0);
});
