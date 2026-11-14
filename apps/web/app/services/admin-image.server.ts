import { runImageWork, ImageWorkBusyError } from './image-work.server';
import sharp from 'sharp';
export class ImageValidationError extends Error {}
export const maxImageBytes = 3 * 1024 * 1024;
export const maxImagePixels = 16_000_000;
// Magic bytes alone accept truncated files and polyglots. Decode and re-encode
// to a bounded, static raster; strip metadata/trailing payloads before Storage.
export async function normalizeImage(file: File) {
  if (file.size < 1 || file.size > maxImageBytes)
    throw new ImageValidationError('Chọn ảnh tối đa 3 MiB.');
  try {
    return await runImageWork(async () => {
      const bytes = Buffer.from(await file.arrayBuffer());
      const image = sharp(bytes, {
        limitInputPixels: maxImagePixels,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      const format = metadata.format;
      const mime =
        format === 'png'
          ? 'image/png'
          : format === 'jpeg'
            ? 'image/jpeg'
            : format === 'webp'
              ? 'image/webp'
              : null;
      if (!mime || file.type !== mime || (metadata.pages ?? 1) !== 1)
        throw new Error();
      const result = await image
        .rotate()
        .toFormat(format as 'png' | 'jpeg' | 'webp')
        .toBuffer({ resolveWithObject: true });
      if (result.data.length > maxImageBytes) throw new Error();
      return {
        bytes: result.data,
        mime,
        ext: format === 'jpeg' ? 'jpg' : format!,
        width: result.info.width,
        height: result.info.height,
      };
    });
  } catch (error) {
    if (error instanceof ImageWorkBusyError) throw error;
    throw new ImageValidationError(
      'Ảnh phải là PNG, JPEG hoặc WebP hợp lệ, tối đa 3 MiB và 16 triệu điểm ảnh; không nhận ảnh động.',
    );
  }
}
