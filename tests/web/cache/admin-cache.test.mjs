import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, beforeEach, test } from 'node:test';
import ts from 'typescript';
const { outputText } = ts.transpileModule(
  await readFile('apps/web/app/services/admin/cache.server.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
);
const {
  readAdminCache: read,
  clearAdminCache: clear,
  adminMutation,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
const originalNow = Date.now;
let now;
beforeEach(() => {
  clear();
  now = 1000;
  Date.now = () => now;
});
after(() => {
  Date.now = originalNow;
});
test('cache isolates users, write permissions and filters', async () => {
  assert.equal(await read('a', true, '/posts?q=a', async () => 'A'), 'A');
  assert.equal(await read('b', true, '/posts?q=a', async () => 'B'), 'B');
  assert.equal(
    await read('a', false, '/posts?q=a', async () => 'readonly'),
    'readonly',
  );
  assert.equal(
    await read('a', true, '/posts?q=b', async () => 'filtered'),
    'filtered',
  );
  assert.equal(
    await read('a', true, '/posts?q=a', async () => assert.fail()),
    'A',
  );
});
test('reads do not extend the 15 second freshness window', async () => {
  await read('a', true, '/', async () => 1);
  now += 14_000;
  assert.equal(await read('a', true, '/', async () => 2), 1);
  now += 1000;
  assert.equal(await read('a', true, '/', async () => 2), 2);
});
test('parallel reads share work and failures can be retried', async () => {
  let count = 0;
  const load = async () => {
    count++;
    return 42;
  };
  assert.deepEqual(
    await Promise.all([read('a', true, '/', load), read('a', true, '/', load)]),
    [42, 42],
  );
  assert.equal(count, 1);
  clear();
  await assert.rejects(
    read('a', true, '/', async () => {
      throw Error('upstream');
    }),
  );
  assert.equal(await read('a', true, '/', load), 42);
});
test('a read racing a mutation cannot repopulate stale data', async () => {
  let finish;
  const old = read(
    'a',
    true,
    '/',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await Promise.resolve();
  await adminMutation(async () => 'saved');
  finish('old');
  await old;
  assert.equal(await read('a', true, '/', async () => 'new'), 'new');
});
test('mutation failures and reads during writes also invalidate snapshots', async () => {
  await assert.rejects(
    adminMutation(async () => {
      await read('a', true, '/', async () => 'during');
      throw Error('failed');
    }),
  );
  assert.equal(await read('a', true, '/', async () => 'after'), 'after');
});
test('cache evicts old entries and skips oversized values', async () => {
  for (let i = 0; i < 33; i++) await read('a', true, String(i), async () => i);
  assert.equal(await read('a', true, '0', async () => 'evicted'), 'evicted');
  await read('a', true, 'large', async () => 'x'.repeat(3 * 1024 * 1024));
  assert.equal(await read('a', true, 'large', async () => 'small'), 'small');
});
