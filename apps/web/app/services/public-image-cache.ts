import type { PostImage } from '@sacute/shared';
// Keep a bounded set of native decoded images alive. The rendered <img> uses
// exactly the same URL/options, sharing the browser's in-flight/decoded resource
// even for no-store responses. Never changes HTTP caching or stores admin bytes.
type Entry = {
  image: HTMLImageElement;
  pixels: number;
  expires: number;
  cancel: () => void;
};
const entries = new Map<string, Entry>();
let pixels = 0;
let pending = 0;
export const publicImageSource = (image: PostImage) =>
  image.thumbnailUrl ?? image.url;
function remove(url: string) {
  const entry = entries.get(url);
  if (!entry) return;
  entry.cancel();
  pixels -= entry.pixels;
  entries.delete(url);
}
export function clearPublicImages() {
  for (const url of entries.keys()) remove(url);
}
export function warmPublicImage(image?: PostImage) {
  if (!image || typeof window === 'undefined') return;
  if (
    !image.thumbnailUrl &&
    (!image.width || !image.height || image.width * image.height > 4_000_000)
  )
    return;
  const url = publicImageSource(image);
  try {
    if (!/^https?:$/.test(new URL(url, window.location.origin).protocol))
      return;
  } catch {
    return;
  }
  const now = Date.now();
  for (const [key, entry] of entries) if (entry.expires <= now) remove(key);
  if (entries.has(url) || pending >= 2) return;
  while (entries.size >= 6) remove(entries.keys().next().value!);
  const prepared = new Image();
  prepared.decoding = 'async';
  prepared.fetchPriority = 'high';
  pending++;
  let settled = false;
  const finish = () => {
    if (!settled) {
      settled = true;
      pending--;
    }
  };
  let expiryTimer: number | undefined;
  const timer = window.setTimeout(() => remove(url), 8000);
  const entry: Entry = {
    image: prepared,
    pixels: 0,
    expires: now + 30_000,
    cancel: () => {
      window.clearTimeout(timer);
      window.clearTimeout(expiryTimer);
      finish();
      prepared.removeAttribute('src');
    },
  };
  entries.set(url, entry);
  prepared.src = url;
  void prepared
    .decode()
    .then(() => {
      window.clearTimeout(timer);
      finish();
      if (entries.get(url) !== entry) return;
      const size = prepared.naturalWidth * prepared.naturalHeight;
      if (!size || size > 4_000_000) {
        remove(url);
        return;
      }
      while (pixels + size > 8_000_000) remove(entries.keys().next().value!);
      if (entries.get(url) !== entry) return;
      entry.pixels = size;
      pixels += size;
      expiryTimer = window.setTimeout(
        () => {
          if (entries.get(url) === entry) remove(url);
        },
        Math.max(0, entry.expires - Date.now()),
      );
    })
    .catch(() => {
      if (entries.get(url) === entry) remove(url);
    });
}
