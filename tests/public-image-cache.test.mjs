import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeEach, after, test } from 'node:test';
import ts from 'typescript';
const { outputText } = ts.transpileModule(
  await readFile('apps/web/app/services/public-image-cache.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
);
const { warmPublicImage, clearPublicImages } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
const originalWindow = globalThis.window,
  originalImage = globalThis.Image;
let images = [];
class FakeImage {
  naturalWidth = 640;
  naturalHeight = 400;
  constructor() {
    images.push(this);
  }
  decode() {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
  removeAttribute() {
    this.src = '';
    this.reject?.(Error('cancelled'));
  }
}
beforeEach(() => {
  clearPublicImages();
  images = [];
  globalThis.window = {
    location: { origin: 'https://sacute.test' },
    setTimeout: (callback, ms) => {
      const timer = setTimeout(callback, ms);
      timer.unref();
      return timer;
    },
    clearTimeout,
  };
  globalThis.Image = FakeImage;
});
after(() => {
  clearPublicImages();
  globalThis.window = originalWindow;
  globalThis.Image = originalImage;
});
const image = (index) => ({
  url: `/original-${index}.png`,
  thumbnailUrl: `/thumbnail-${index}?width=640`,
  width: 1200,
  height: 800,
  alt: '',
});
const flush = () => new Promise((resolve) => setImmediate(resolve));
test('intent warming uses the rendered URL, shares work, and starts at most two decodes', async () => {
  warmPublicImage(image(1));
  warmPublicImage(image(1));
  warmPublicImage(image(2));
  warmPublicImage(image(3));
  assert.equal(images.length, 2);
  assert.equal(images[0].src, image(1).thumbnailUrl);
  images[0].resolve();
  await flush();
  warmPublicImage(image(3));
  assert.equal(images.length, 3);
});
test('clearing public data cancels preparation and old completions cannot warm a new generation', async () => {
  warmPublicImage(image(1));
  const old = images[0];
  clearPublicImages();
  assert.equal(old.src, '');
  old.resolve();
  await flush();
  warmPublicImage(image(1));
  assert.equal(images.length, 2);
});
test('invalid URLs and unbounded originals are skipped; failed preparation can retry', async () => {
  warmPublicImage({
    url: 'javascript:alert(1)',
    width: 10,
    height: 10,
    alt: '',
  });
  warmPublicImage({ url: '/huge.png', width: 10000, height: 10000, alt: '' });
  assert.equal(images.length, 0);
  warmPublicImage(image(1));
  images[0].reject(Error('decode failure'));
  await flush();
  warmPublicImage(image(1));
  assert.equal(images.length, 2);
});
test('retained decoded images are evicted at the entry bound', async () => {
  for (let i = 0; i < 7; i++) {
    warmPublicImage(image(i));
    images[i].resolve();
    await flush();
  }
  assert.equal(images[0].src, '');
  assert.notEqual(images.at(-1).src, '');
});
