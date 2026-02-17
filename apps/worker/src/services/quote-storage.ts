import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'quote-storage' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuoteUploadResult {
  imageUrl: string;
  thumbnailUrl: string | null;
}

// ---------------------------------------------------------------------------
// S3 client (configured for Cloudflare R2)
// ---------------------------------------------------------------------------

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    if (!accountId) {
      throw new Error('R2_ACCOUNT_ID is not set');
    }

    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  return s3Client;
}

// ---------------------------------------------------------------------------
// Demo Mode Storage (local filesystem)
// ---------------------------------------------------------------------------

function uploadToLocalStorage(
  imageBuffer: Buffer,
  userId: string,
  quoteJobId: string,
): QuoteUploadResult {
  const outputDir = join('/tmp', 'reelforge-quotes', userId);
  mkdirSync(outputDir, { recursive: true });

  const imagePath = join(outputDir, `${quoteJobId}.png`);
  writeFileSync(imagePath, imageBuffer);

  log.warn(
    { imagePath },
    'DEMO MODE: Saved quote image to local filesystem (configure R2_ACCOUNT_ID for cloud storage)',
  );

  return {
    imageUrl: `file://${imagePath}`,
    thumbnailUrl: null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload quote image to Cloudflare R2 storage.
 * Falls back to local storage if R2 credentials are not configured (demo mode).
 */
export async function uploadQuoteToStorage(
  imageBuffer: Buffer,
  userId: string,
  quoteJobId: string,
): Promise<QuoteUploadResult> {
  const hasR2Config =
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;

  if (!hasR2Config) {
    log.warn('R2 credentials not configured - using local storage demo mode');
    return uploadToLocalStorage(imageBuffer, userId, quoteJobId);
  }

  const bucket = process.env.R2_BUCKET_NAME || 'reelforge-media';
  const cdnUrl = process.env.CDN_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.dev`;
  const client = getS3Client();

  const imageKey = `quotes/${userId}/${quoteJobId}.png`;
  log.info({ bucket, key: imageKey, sizeBytes: imageBuffer.length }, 'Uploading quote image to R2');

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: imageKey,
      Body: imageBuffer,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        userId,
        quoteJobId,
        uploadedAt: new Date().toISOString(),
      },
    }),
  );

  const imageUrl = `${cdnUrl}/${imageKey}`;
  const thumbnailUrl = `${cdnUrl}/thumbnails/quotes/${userId}/${quoteJobId}.jpg`;

  log.info({ imageUrl }, 'Quote image uploaded to R2 successfully');

  return { imageUrl, thumbnailUrl };
}
