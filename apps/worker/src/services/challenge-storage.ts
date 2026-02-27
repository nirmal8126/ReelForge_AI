import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'challenge-storage' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChallengeUploadResult {
  outputUrl: string;
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
  videoBuffer: Buffer,
  thumbnailBuffer: Buffer | null,
  userId: string,
  challengeJobId: string,
): ChallengeUploadResult {
  const outputDir = join('/tmp', 'reelforge-challenges', userId);
  mkdirSync(outputDir, { recursive: true });

  const videoPath = join(outputDir, `${challengeJobId}.mp4`);
  writeFileSync(videoPath, videoBuffer);

  let thumbnailUrl: string | null = null;
  if (thumbnailBuffer) {
    const thumbPath = join(outputDir, `${challengeJobId}_thumb.jpg`);
    writeFileSync(thumbPath, thumbnailBuffer);
    thumbnailUrl = `file://${thumbPath}`;
  }

  log.warn(
    { videoPath, sizeBytes: videoBuffer.length },
    'DEMO MODE: Saved challenge video to local filesystem (configure R2_ACCOUNT_ID for cloud storage)',
  );

  return {
    outputUrl: `file://${videoPath}`,
    thumbnailUrl,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function uploadChallengeToStorage(
  videoBuffer: Buffer,
  thumbnailBuffer: Buffer | null,
  userId: string,
  challengeJobId: string,
): Promise<ChallengeUploadResult> {
  const hasR2Config =
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;

  if (!hasR2Config) {
    log.warn('R2 credentials not configured - using local storage demo mode');
    return uploadToLocalStorage(videoBuffer, thumbnailBuffer, userId, challengeJobId);
  }

  const bucket = process.env.R2_BUCKET_NAME || 'reelforge-media';
  const cdnUrl = process.env.CDN_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.dev`;
  const client = getS3Client();

  // Upload video
  const videoKey = `challenges/${userId}/${challengeJobId}.mp4`;
  log.info({ bucket, key: videoKey, sizeBytes: videoBuffer.length }, 'Uploading challenge video to R2');

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: videoKey,
      Body: videoBuffer,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        userId,
        challengeJobId,
        uploadedAt: new Date().toISOString(),
      },
    }),
  );

  const outputUrl = `${cdnUrl}/${videoKey}`;
  let thumbnailUrl: string | null = null;

  // Upload thumbnail
  if (thumbnailBuffer) {
    const thumbKey = `challenges/${userId}/${challengeJobId}_thumb.jpg`;
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

  log.info({ outputUrl, thumbnailUrl }, 'Challenge video uploaded to R2 successfully');

  return { outputUrl, thumbnailUrl };
}
