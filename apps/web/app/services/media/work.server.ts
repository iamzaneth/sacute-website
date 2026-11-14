export class ImageWorkBusyError extends Error {}
// Bound native decoders AND queued inputs. Merely limiting a pending Map does
// not stop Sharp jobs from being launched once that Map is full.
export function createImageWorkQueue(concurrency = 2, maxQueued = 8) {
  let active = 0;
  const queue: Array<() => void> = [];
  return function run<T>(work: () => Promise<T>): Promise<T> {
    if (active >= concurrency && queue.length >= maxQueued)
      return Promise.reject(new ImageWorkBusyError('Image processing busy'));
    return new Promise((resolve, reject) => {
      const start = () => {
        active++;
        void (async () => {
          try {
            resolve(await work());
          } catch (error) {
            reject(error);
          } finally {
            active--;
            queue.shift()?.();
          }
        })();
      };
      if (active < concurrency) start();
      else queue.push(start);
    });
  };
}
export const runImageWork = createImageWorkQueue();
