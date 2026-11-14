import { runImageWork, ImageWorkBusyError } from './work.server';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const entries = new Map<string, Uint8Array>();
const pending = new Map<string, Promise<Uint8Array>>();
let bytes = 0;
export class ImageVariantError extends Error {}
export function imageWidth(request: Request) {
  const value = new URL(request.url).searchParams.get('width');
  if (value === null) return undefined;
  const width = Number(value);
  if (!['320', '640', '1280'].includes(value))
    throw new Response('Kích thước ảnh không hợp lệ.', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  return width;
}
// Call only AFTER checking current visibility/identity and downloading the object.
// Content hashes avoid stale transforms when a legacy storage path is overwritten.
export async function imageVariant(blob: Blob, width?: number): Promise<Blob> {
  if (width === undefined) return blob;
  if (
    ![320, 640, 1280].includes(width) ||
    blob.size < 1 ||
    blob.size > 10 * 1024 * 1024
  )
    throw new ImageVariantError('Invalid image input');
  const source = Buffer.from(await blob.arrayBuffer());
  const key = `${createHash('sha256').update(source).digest('hex')}:${width}`;
  let result = entries.get(key);
  if (result) {
    entries.delete(key);
    entries.set(key, result);
  } else {
    let job = pending.get(key);
    if (!job) {
      job = runImageWork(() =>
        sharp(source, { limitInputPixels: 16_000_000, failOn: 'warning' })
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer(),
      );
      pending.set(key, job);
    }
    try {
      result = await job;
    } catch (error) {
      if (error instanceof ImageWorkBusyError) throw error;
      throw new ImageVariantError('Invalid image');
    } finally {
      if (pending.get(key) === job) pending.delete(key);
    }
    if (!entries.has(key) && result.byteLength <= 16 * 1024 * 1024) {
      entries.set(key, result);
      bytes += result.byteLength;
      while (entries.size > 64 || bytes > 16 * 1024 * 1024) {
        const oldest = entries.keys().next().value!;
        bytes -= entries.get(oldest)!.byteLength;
        entries.delete(oldest);
      }
    }
  }
  return new Blob([result as BlobPart], { type: 'image/webp' });
}
