import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
const { outputText } = ts.transpileModule(
  await readFile('apps/web/app/services/cache/versioned.server.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
);
const { createVersionedCache } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('hits always verify DB version; two process caches observe writes and publication boundaries', async () => {
  const caches = [createVersionedCache(), createVersionedCache()];
  let revision = '1',
    checks = 0,
    loads = 0;
  const version = async () => {
    checks++;
    return { revision, now: new Date().toISOString() };
  };
  const load = async () => {
    loads++;
    return revision;
  };
  for (const read of caches)
    assert.equal(await read('post', version, load), '1');
  assert.equal(loads, 2);
  for (const read of caches)
    assert.equal(await read('post', version, load), '1');
  assert.equal(loads, 2);
  assert.equal(checks, 6);
  revision = '2';
  for (const read of caches)
    assert.equal(await read('post', version, load), '2');
  assert.equal(loads, 4);
});
test('concurrent identical versions share one payload read', async () => {
  const read = createVersionedCache();
  let loads = 0;
  const version = async () => ({ revision: '1', now: '' });
  const load = async () => {
    loads++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return 42;
  };
  assert.deepEqual(
    await Promise.all(
      Array.from({ length: 10 }, () => read('list', version, load)),
    ),
    Array(10).fill(42),
  );
  assert.equal(loads, 1);
});
test('write racing a read is retried and cannot repopulate an old version', async () => {
  const read = createVersionedCache();
  let revision = 'old',
    loads = 0;
  const version = async () => ({ revision, now: '' });
  const load = async () => {
    loads++;
    const value = revision;
    revision = 'new';
    return value;
  };
  assert.equal(await read('list', version, load), 'new');
  assert.equal(loads, 2);
  assert.equal(await read('list', version, load), 'new');
  assert.equal(loads, 2);
});
test('failed verification never returns cached content and errors remain retryable', async () => {
  const read = createVersionedCache();
  const version = async () => ({ revision: '1', now: '' });
  await assert.rejects(
    read('x', version, async () => {
      throw Error('read failed');
    }),
  );
  assert.equal(await read('x', version, async () => 42), 42);
  await assert.rejects(
    read(
      'x',
      async () => {
        throw Error('DB down');
      },
      async () => 43,
    ),
  );
});
test('oversized representations are not retained; cached resource keys are isolated', async () => {
  const read = createVersionedCache(20);
  let loads = 0;
  const version = async () => ({ revision: '1', now: '' });
  const load = async () => {
    loads++;
    return 'x'.repeat(100);
  };
  await read('a', version, load);
  await read('a', version, load);
  assert.equal(loads, 2);
  assert.equal(await read('b', version, async () => 2), 2);
  assert.equal(await read('c', version, async () => 3), 3);
});

test('new distinct reads are rejected once the pending-work bound is reached', async () => {
  const read = createVersionedCache();
  const release = [];
  const version = async () => ({ revision: '1', now: '' });
  const jobs = Array.from({ length: 64 }, (_, i) =>
    read(
      String(i),
      version,
      () => new Promise((resolve) => release.push(() => resolve(i))),
    ),
  );
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    read('overflow', version, async () => 999),
    /queue is full/,
  );
  for (const done of release) done();
  assert.equal((await Promise.all(jobs)).length, 64);
  assert.equal(await read('overflow', version, async () => 999), 999);
});
