import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'gameplay-storage' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameplayUploadResult {
  outputUrl: string;
  thumbnailUrl: string | null;
}

// ---------------------------------------------------------------------------
// S3 client (configured for Cloudflare R2)
// ---------------------------------------------------------------------------

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");
    if (!endpoint) {
      throw new Error('R2_ENDPOINT or R2_ACCOUNT_ID is not set');
    }

    s3Client = new S3Client({
      region: 'auto',
      endpoint,
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
  videoBuffer: Buffer,
  thumbnailBuffer: Buffer | null,
  userId: string,
  gameplayJobId: string,
): GameplayUploadResult {
  const outputDir = join('/tmp', 'reelforge-gameplay', userId);
  mkdirSync(outputDir, { recursive: true });

  const videoPath = join(outputDir, `${gameplayJobId}.mp4`);
  writeFileSync(videoPath, videoBuffer);

  let thumbnailUrl: string | null = null;
  if (thumbnailBuffer) {
    const thumbPath = join(outputDir, `${gameplayJobId}_thumb.jpg`);
    writeFileSync(thumbPath, thumbnailBuffer);
    thumbnailUrl = `file://${thumbPath}`;
  }

  log.warn(
    { videoPath, sizeBytes: videoBuffer.length },
    'DEMO MODE: Saved gameplay video to local filesystem (configure R2_ACCOUNT_ID for cloud storage)',
  );

  return {
    outputUrl: `file://${videoPath}`,
    thumbnailUrl,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function uploadGameplayToStorage(
  videoBuffer: Buffer,
  thumbnailBuffer: Buffer | null,
  userId: string,
  gameplayJobId: string,
): Promise<GameplayUploadResult> {
  const hasR2Config =
    (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID) && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;

  if (!hasR2Config) {
    log.warn('R2 credentials not configured - using local storage demo mode');
    return uploadToLocalStorage(videoBuffer, thumbnailBuffer, userId, gameplayJobId);
  }

  const bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || 'reelforge-videos';
  const cdnUrl = process.env.CDN_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.dev`;
  const client = getS3Client();

  // Upload video
  const videoKey = `gameplay/${userId}/${gameplayJobId}.mp4`;
  log.info({ bucket, key: videoKey, sizeBytes: videoBuffer.length }, 'Uploading gameplay video to R2');

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: videoKey,
      Body: videoBuffer,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        userId,
        gameplayJobId,
        uploadedAt: new Date().toISOString(),
      },
    }),
  );

  const outputUrl = `${cdnUrl}/${videoKey}`;
  let thumbnailUrl: string | null = null;

  // Upload thumbnail
  if (thumbnailBuffer) {
    const thumbKey = `gameplay/${userId}/${gameplayJobId}_thumb.jpg`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    thumbnailUrl = `${cdnUrl}/${thumbKey}`;
  }

  log.info({ outputUrl, thumbnailUrl }, 'Gameplay video uploaded to R2 successfully');

  return { outputUrl, thumbnailUrl };
}
