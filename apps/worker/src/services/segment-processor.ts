import { LongFormSegment } from '@reelforge/db';
import { logger } from '../utils/logger';
import { downloadStockFootage } from './stock-footage';
import { prisma } from '@reelforge/db';
import { getActiveProviders } from './service-config';

const log = logger.child({ service: 'segment-processor' });

export interface ProcessSegmentsOptions {
  segments: LongFormSegment[];
  longFormJobId: string;
  prompt: string;
  style?: string;
  aiClipRatio: number;
  useStockFootage: boolean;
  useStaticVisuals: boolean;
  aspectRatio: string;
  onProgress?: (progress: number) => Promise<void>;
}

export interface ProcessedSegment extends LongFormSegment {
  visualType: 'AI_CLIP' | 'STOCK_VIDEO' | 'STATIC_IMAGE';
  assetUrl: string;
}

/**
 * Process all segments using hybrid approach:
 * - AI clips for hooks/key moments (based on aiClipRatio) — requires RUNWAY_API_KEY
 * - Stock footage for filler content — requires PEXELS_API_KEY or PIXABAY_API_KEY
 * - Static images as fallback (always available)
 *
 * Falls back gracefully: AI → Stock → Static
 */
export async function processSegments(
  opts: ProcessSegmentsOptions
): Promise<ProcessedSegment[]> {
  const { segments, longFormJobId, prompt, style, aiClipRatio, useStockFootage, useStaticVisuals, onProgress } = opts;

  // Check if any video providers are available (admin-configured)
  const videoProviders = await getActiveProviders('video');
  const hasVideoProviders = videoProviders.length > 0;
  const hasStockKeys = !!(process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY);

  log.info({
    segmentCount: segments.length,
    aiClipRatio,
    videoProviders: videoProviders.map((p) => p.id),
    hasStockKeys,
    useStockFootage,
    useStaticVisuals,
  }, 'Starting segment processing');

  // Determine which segments should attempt AI generation
  const totalSegments = segments.length;
  const aiSegmentCount = hasVideoProviders ? Math.ceil(totalSegments * aiClipRatio) : 0;

  const aiSegmentIndices = new Set<number>();
  if (aiSegmentCount > 0) {
    aiSegmentIndices.add(0); // First segment (hook)
    if (totalSegments > 1) {
      aiSegmentIndices.add(totalSegments - 1); // Last segment (CTA)
    }
    // Distribute remaining AI clips evenly
    const remainingAiClips = Math.max(0, aiSegmentCount - aiSegmentIndices.size);
    if (remainingAiClips > 0 && totalSegments > 2) {
      const step = Math.floor(totalSegments / (remainingAiClips + 1));
      for (let i = 0; i < remainingAiClips; i++) {
        const index = Math.min((i + 1) * step, totalSegments - 2);
        if (index > 0) aiSegmentIndices.add(index);
      }
    }
  }

  if (!hasVideoProviders && aiClipRatio > 0) {
    log.warn('No video providers available — all segments will use stock footage or static visuals');
  }

  // Process segments in batches
  const BATCH_SIZE = 3;
  const processedSegments: ProcessedSegment[] = [];
  let completedCount = 0;

  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    const batch = segments.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (segment, batchIndex) => {
        const globalIndex = i + batchIndex;
        const shouldTryAI = aiSegmentIndices.has(globalIndex) && hasVideoProviders;

        try {
          log.info({ segmentIndex: globalIndex, title: segment.title, shouldTryAI }, 'Processing segment');

          await prisma.longFormSegment.update({
            where: { id: segment.id },
            data: { status: 'PROCESSING' },
          });

          let visualType: 'AI_CLIP' | 'STOCK_VIDEO' | 'STATIC_IMAGE';
          let assetUrl: string;

          if (shouldTryAI) {
            // Try AI clip generation via RunwayML
            try {
              visualType = 'AI_CLIP';
              log.info({ segmentIndex: globalIndex }, 'Generating AI clip via RunwayML');

              const { generateVideo } = await import('./video-generator');
              const videoBuffer = await generateVideo({
                prompt: `${style || 'cinematic'} style: ${segment.title}`,
                style: style || 'cinematic',
                durationSeconds: 10,
                aspectRatio: opts.aspectRatio,
              });

              const { uploadToStorage } = await import('./storage');
              const { url } = await uploadToStorage({
                buffer: videoBuffer,
                userId: 'system',
                reelJobId: `${longFormJobId}-seg-${globalIndex}`,
              });

              assetUrl = url;
              log.info({ segmentIndex: globalIndex }, 'AI clip generated');
            } catch (aiError) {
              log.warn({ segmentIndex: globalIndex, err: aiError }, 'AI clip failed, falling back');
              // Fall through to stock/static
              const fallback = await getFallbackVisual(segment, globalIndex, useStockFootage, hasStockKeys, useStaticVisuals);
              visualType = fallback.visualType;
              assetUrl = fallback.assetUrl;
            }
          } else if (useStockFootage && hasStockKeys) {
            visualType = 'STOCK_VIDEO';
            log.info({ segmentIndex: globalIndex }, 'Downloading stock footage');
            assetUrl = await downloadStockFootage({
              query: segment.title,
              durationSeconds: Math.ceil(segment.endTime - segment.startTime),
            });
            // If stock returned a placeholder URL, treat as static image
            if (assetUrl.includes('via.placeholder.com')) {
              visualType = 'STATIC_IMAGE';
            }
          } else {
            visualType = 'STATIC_IMAGE';
            log.info({ segmentIndex: globalIndex }, 'Using static visual');
            assetUrl = generateStaticImageUrl(segment.title, opts.aspectRatio);
          }

          // Update segment in database
          await prisma.longFormSegment.update({
            where: { id: segment.id },
            data: { visualType, assetUrl, status: 'COMPLETED' },
          });

          log.info({ segmentIndex: globalIndex, visualType }, 'Segment processed');

          return { ...segment, visualType, assetUrl } as ProcessedSegment;
        } catch (error) {
          log.error({ segmentIndex: globalIndex, err: error }, 'Segment processing failed');

          await prisma.longFormSegment.update({
            where: { id: segment.id },
            data: { status: 'FAILED' },
          });

          // Always provide a fallback so the video can still be composed
          const fallbackUrl = generateStaticImageUrl('Video Segment', opts.aspectRatio);
          return {
            ...segment,
            visualType: 'STATIC_IMAGE' as const,
            assetUrl: fallbackUrl,
          } as ProcessedSegment;
        } finally {
          completedCount++;
          if (onProgress) {
            const progress = Math.floor((completedCount / segments.length) * 100);
            await onProgress(progress);
          }
        }
      })
    );

    processedSegments.push(...batchResults);

    // Brief delay between batches for API rate limits
    if (i + BATCH_SIZE < segments.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  log.info({ processedCount: processedSegments.length }, 'All segments processed');
  return processedSegments;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getFallbackVisual(
  segment: LongFormSegment,
  index: number,
  useStockFootage: boolean,
  hasStockKeys: boolean,
  useStaticVisuals: boolean,
): Promise<{ visualType: 'STOCK_VIDEO' | 'STATIC_IMAGE'; assetUrl: string }> {
  if (useStockFootage && hasStockKeys) {
    try {
      const url = await downloadStockFootage({
        query: segment.title,
        durationSeconds: Math.ceil(segment.endTime - segment.startTime),
      });
      if (!url.includes('via.placeholder.com')) {
        return { visualType: 'STOCK_VIDEO', assetUrl: url };
      }
    } catch {
      // Fall through to static
    }
  }

  return {
    visualType: 'STATIC_IMAGE',
    assetUrl: generateStaticImageUrl(segment.title, '16:9'),
  };
}

function generateStaticImageUrl(title: string, aspectRatio: string): string {
  const dimensions = aspectRatio === '9:16' ? '1080x1920' : aspectRatio === '1:1' ? '1080x1080' : '1920x1080';
  return `https://placehold.co/${dimensions}/6366F1/FFFFFF?text=${encodeURIComponent(title.substring(0, 40))}`;
}
