import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'storage' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadOptions {
  buffer: Buffer;
  userId: string;
  reelJobId: string;
}

export interface UploadResult {
  url: string;
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

function uploadToLocalStorage(opts: UploadOptions): UploadResult {
  const { buffer, userId, reelJobId } = opts;

  const outputDir = join('/tmp', 'reelforge-reels', userId);
  mkdirSync(outputDir, { recursive: true });

  const filePath = join(outputDir, `${reelJobId}.mp4`);
  writeFileSync(filePath, buffer);

  log.warn({ filePath, sizeBytes: buffer.length }, 'DEMO MODE: Saved to local filesystem (configure R2_ACCOUNT_ID for cloud storage)');

  return {
    url: `file://${filePath}`,
    thumbnailUrl: null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload a composed reel to Cloudflare R2 storage.
 * Falls back to local storage if R2 credentials are not configured (demo mode).
 *
 * Key format: reels/{userId}/{reelJobId}.mp4
 * Returns the public CDN URL and thumbnail URL.
 */
export async function uploadToStorage(opts: UploadOptions): Promise<UploadResult> {
  const { buffer, userId, reelJobId } = opts;

  // Check if R2 is configured
  const hasR2Config = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;

  if (!hasR2Config) {
    log.warn('R2 credentials not configured - using local storage demo mode');
    return uploadToLocalStorage(opts);
  }

  const bucket = process.env.R2_BUCKET_NAME || 'reelforge-media';
  const cdnUrl = process.env.CDN_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.dev`;
  const key = `reels/${userId}/${reelJobId}.mp4`;

  log.info({ bucket, key, sizeBytes: buffer.length }, 'Uploading reel to R2');

  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: {
      userId,
      reelJobId,
      uploadedAt: new Date().toISOString(),
    },
  });

  await client.send(command);

  const url = `${cdnUrl}/${key}`;
  const thumbnailUrl = `${cdnUrl}/thumbnails/${userId}/${reelJobId}.jpg`;

  log.info({ url, thumbnailUrl }, 'Reel uploaded to R2 successfully');

  return { url, thumbnailUrl };
}

// ---------------------------------------------------------------------------
// Scene Image Upload (for cartoon episode scene previews)
// ---------------------------------------------------------------------------

/**
 * Upload a scene image to storage and return the public URL.
 * Falls back to local storage if R2 is not configured.
 */
export async function uploadSceneImage(opts: {
  buffer: Buffer;
  userId: string;
  episodeId: string;
  sceneIndex: number;
  contentType?: string;
}): Promise<string> {
  const { buffer, userId, episodeId, sceneIndex, contentType = 'image/png' } = opts;
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const key = `cartoon-scenes/${userId}/${episodeId}/scene-${sceneIndex}.${ext}`;

  const hasR2Config = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;

  if (!hasR2Config) {
    // Local storage fallback
    const outputDir = join('/tmp', 'reelforge-scenes', userId, episodeId);
    mkdirSync(outputDir, { recursive: true });
    const filePath = join(outputDir, `scene-${sceneIndex}.${ext}`);
    writeFileSync(filePath, buffer);
    log.warn({ filePath }, 'Scene image saved to local filesystem (no R2 config)');
    return `file://${filePath}`;
  }

  const bucket = process.env.R2_BUCKET_NAME || 'reelforge-media';
  const cdnUrl = process.env.CDN_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.dev`;
  const client = getS3Client();

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  const url = `${cdnUrl}/${key}`;
  log.info({ url, sceneIndex }, 'Scene image uploaded to R2');
  return url;
}
