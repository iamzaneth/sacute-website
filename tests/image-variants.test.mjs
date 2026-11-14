import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const require = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
);
const sharpURL = pathToFileURL(require.resolve('sharp')).href;
const sharp = (await import(sharpURL)).default;
const work = ts.transpileModule(
  await readFile('apps/web/app/services/image-work.server.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
);
const workURL = `data:text/javascript;base64,${Buffer.from(work.outputText).toString('base64')}`;
const { createImageWorkQueue, ImageWorkBusyError } = await import(workURL);
const source = (
  await readFile('apps/web/app/services/image-variants.server.ts', 'utf8')
)
  .replace("'sharp'", JSON.stringify(sharpURL))
  .replace("'./image-work.server'", JSON.stringify(workURL));
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { imageVariant, imageWidth } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
test('variants reduce decode dimensions, preserve originals, and key transforms by content bytes', async () => {
  const source = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#f97316' },
  })
    .png()
    .toBuffer();
  const blob = new Blob([source], { type: 'image/png' });
  assert.equal(await imageVariant(blob), blob);
  const transformed = await Promise.all([
    imageVariant(blob, 320),
    imageVariant(blob, 320),
  ]);
  const metadata = await sharp(
    Buffer.from(await transformed[0].arrayBuffer()),
  ).metadata();
  assert.equal(metadata.width, 320);
  assert.equal(metadata.height, 213);
  assert.equal(metadata.format, 'webp');
  assert.ok(transformed[0].size < blob.size);
  assert.deepEqual(
    await transformed[0].arrayBuffer(),
    await transformed[1].arrayBuffer(),
  );
  const updated = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#000000' },
  })
    .png()
    .toBuffer();
  assert.notDeepEqual(
    await (await imageVariant(new Blob([updated]), 320)).arrayBuffer(),
    await transformed[0].arrayBuffer(),
  );
  console.log(
    JSON.stringify({
      originalBytes: blob.size,
      variantBytes: transformed[0].size,
      originalPixels: 2400 * 1600,
      variantPixels: metadata.width * metadata.height,
    }),
  );
});
test('only bounded variants are accepted and invalid images fail', async () => {
  assert.equal(imageWidth(new Request('http://test/file')), undefined);
  assert.equal(imageWidth(new Request('http://test/file?width=640')), 640);
  assert.throws(() => imageWidth(new Request('http://test/file?width=99999')));
  await assert.rejects(imageVariant(new Blob(['invalid']), 320));
  await assert.rejects(imageVariant(new Blob(['invalid']), 0));
  assert.throws(() => imageWidth(new Request('http://test/file?width=3.2e2')));
});

test('native work is limited to two active jobs, rejects overflow, and recovers after errors', async () => {
  const run = createImageWorkQueue(2, 2);
  let active = 0,
    maximum = 0;
  const release = [];
  const work = () =>
    new Promise((resolve) => {
      active++;
      maximum = Math.max(maximum, active);
      release.push(() => {
        active--;
        resolve(42);
      });
    });
  const jobs = Array.from({ length: 4 }, () => run(work));
  await assert.rejects(run(work), ImageWorkBusyError);
  assert.equal(active, 2);
  release.shift()();
  await new Promise((resolve) => setImmediate(resolve));
  release.shift()();
  await new Promise((resolve) => setImmediate(resolve));
  while (release.length) release.shift()();
  assert.deepEqual(await Promise.all(jobs), [42, 42, 42, 42]);
  assert.equal(maximum, 2);
  await assert.rejects(
    run(async () => {
      throw Error('decode failed');
    }),
  );
  assert.equal(await run(async () => 1), 1);
});
