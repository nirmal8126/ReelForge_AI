import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload a composed reel to Cloudflare R2 storage.
 *
 * Key format: reels/{userId}/{reelJobId}.mp4
 * Returns the public CDN URL and thumbnail URL.
 */
export async function uploadToStorage(opts: UploadOptions): Promise<UploadResult> {
  const { buffer, userId, reelJobId } = opts;

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
