import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Serves locally-stored media files during development.
 * Routes:
 *   /api/media/reels/{userId}/{jobId}.mp4
 *   /api/media/scenes/{userId}/{episodeId}/scene-{index}.png
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;

  if (!segments || segments.length < 2) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const type = segments[0]; // "reels" or "scenes"
  let filePath: string;

  if (type === 'reels' && segments.length >= 3) {
    // /api/media/reels/{userId}/{file}
    const userId = segments[1];
    const file = segments[2];
    filePath = join('/tmp', 'reelforge-reels', userId, file);
  } else if (type === 'scenes' && segments.length >= 4) {
    // /api/media/scenes/{userId}/{episodeId}/{file}
    const userId = segments[1];
    const episodeId = segments[2];
    const file = segments[3];
    filePath = join('/tmp', 'reelforge-scenes', userId, episodeId, file);
  } else {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Security: ensure resolved path stays within /tmp/reelforge-*
  if (!filePath.startsWith('/tmp/reelforge-')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const buffer = readFileSync(filePath);
  const ext = filePath.split('.').pop()?.toLowerCase();

  const contentType =
    ext === 'mp4' ? 'video/mp4' :
    ext === 'png' ? 'image/png' :
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    ext === 'ppm' ? 'image/x-portable-pixmap' :
    'application/octet-stream';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
