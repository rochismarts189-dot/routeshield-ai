import crypto from 'crypto';
import sharp from 'sharp';

export interface ProcessedEvidence {
  normalizedBuffer: Buffer;
  sha256Hex: string;
  contentType: 'image/jpeg' | 'image/png';
  byteCount: number;
}

export async function processAndNormalizePhoto(
  inputBuffer: Buffer,
  mimeType: string
): Promise<ProcessedEvidence> {
  if (inputBuffer.length > 5 * 1024 * 1024) {
    throw new Error('Image exceeds 5MB size limit');
  }

  // Use Sharp to decode, verify image content, strip metadata, and resize longest edge to max 1600px
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image: unable to read dimensions');
  }

  // 20 Megapixels decoded check
  const totalPixels = metadata.width * metadata.height;
  if (totalPixels > 20_000_000) {
    throw new Error('Decoded image exceeds 20 megapixel safety limit');
  }

  // Resize longest edge to 1600px if larger, preserve aspect ratio, strip EXIF metadata
  const longestEdge = Math.max(metadata.width, metadata.height);
  let pipeline = image.rotate(); // auto-rotate based on EXIF before stripping

  if (longestEdge > 1600) {
    if (metadata.width >= metadata.height) {
      pipeline = pipeline.resize({ width: 1600, withoutEnlargement: true });
    } else {
      pipeline = pipeline.resize({ height: 1600, withoutEnlargement: true });
    }
  }

  // Normalize to standard JPEG for consistent hashing and efficient storage
  const normalizedBuffer = await pipeline
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const sha256Hex = crypto
    .createHash('sha256')
    .update(normalizedBuffer)
    .digest('hex')
    .toLowerCase();

  return {
    normalizedBuffer,
    sha256Hex,
    contentType: 'image/jpeg',
    byteCount: normalizedBuffer.length,
  };
}
