import { spawn } from 'node:child_process';
import { testKey } from './supabase.mjs';
import { startAdminFixture } from './admin-supabase.mjs';
const database = await startAdminFixture(54329);
const child = spawn(process.execPath, ['scripts/preview.mjs'], {
  cwd: 'apps/web',
  env: {
    ...process.env,
    SUPABASE_URL: database.url,
    SUPABASE_PUBLISHABLE_KEY: testKey,
    ADMIN_WRITES_ENABLED: 'false',
    ADMIN_ORIGIN: 'http://127.0.0.1:4173',
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
