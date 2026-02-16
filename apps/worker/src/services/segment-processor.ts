import { LongFormSegment } from '@reelforge/db';
import { logger } from '../utils/logger';
import { generateVideo } from './video-generator';
import { downloadStockFootage } from './stock-footage';
import { prisma } from '@reelforge/db';

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
 * Process all segments in parallel using hybrid approach:
 * - AI clips for hooks/key moments (based on aiClipRatio)
 * - Stock footage for filler content
 * - Static images for text/quotes
 */
export async function processSegments(
  opts: ProcessSegmentsOptions
): Promise<ProcessedSegment[]> {
  const { segments, longFormJobId, prompt, style, aiClipRatio, useStockFootage, useStaticVisuals, onProgress } = opts;

  log.info({ segmentCount: segments.length, aiClipRatio }, 'Starting segment processing');

  // Determine visual type for each segment
  const totalSegments = segments.length;
  const aiSegmentCount = Math.ceil(totalSegments * aiClipRatio);

  // AI clips for first and last segments (hooks/CTAs) + evenly distributed key moments
  const aiSegmentIndices = new Set<number>();
  aiSegmentIndices.add(0); // First segment always AI
  if (totalSegments > 1) {
    aiSegmentIndices.add(totalSegments - 1); // Last segment always AI
  }

  // Distribute remaining AI clips evenly
  const remainingAiClips = Math.max(0, aiSegmentCount - aiSegmentIndices.size);
  const step = Math.floor(totalSegments / (remainingAiClips + 1));
  for (let i = 0; i < remainingAiClips; i++) {
    const index = Math.min((i + 1) * step, totalSegments - 2);
    if (index > 0) {
      aiSegmentIndices.add(index);
    }
  }

  // Process segments in batches to avoid overwhelming APIs
  const BATCH_SIZE = 3;
  const processedSegments: ProcessedSegment[] = [];
  let completedCount = 0;

  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    const batch = segments.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (segment, batchIndex) => {
        const globalIndex = i + batchIndex;
        const isAiSegment = aiSegmentIndices.has(globalIndex);

        try {
          log.info({ segmentIndex: globalIndex, title: segment.title }, 'Processing segment');

          // Update segment status
          await prisma.longFormSegment.update({
            where: { id: segment.id },
            data: { status: 'PROCESSING' },
          });

          let visualType: 'AI_CLIP' | 'STOCK_VIDEO' | 'STATIC_IMAGE';
          let assetUrl: string;

          if (isAiSegment) {
            // Generate AI video clip
            visualType = 'AI_CLIP';
            log.info({ segmentIndex: globalIndex }, 'Generating AI clip');

            const videoBuffer = await generateVideo({
              prompt: segment.title,
              style: style || 'cinematic',
              durationSeconds: 10, // RunwayML supports 5s or 10s
            });

            // Upload to temporary storage (reusing existing storage service)
            const { uploadToStorage } = await import('./storage');
            const { url } = await uploadToStorage({
              buffer: videoBuffer,
              userId: 'system',
              reelJobId: `${longFormJobId}-segment-${globalIndex}`,
            });

            assetUrl = url;
          } else if (useStockFootage) {
            // Download stock footage
            visualType = 'STOCK_VIDEO';
            log.info({ segmentIndex: globalIndex }, 'Downloading stock footage');

            assetUrl = await downloadStockFootage({
              query: segment.title,
              durationSeconds: Math.ceil(segment.endTime - segment.startTime),
            });
          } else if (useStaticVisuals) {
            // Use static image placeholder
            visualType = 'STATIC_IMAGE';
            log.info({ segmentIndex: globalIndex }, 'Using static visual');
            assetUrl = `https://via.placeholder.com/1280x720/6366F1/FFFFFF?text=${encodeURIComponent(segment.title)}`;
          } else {
            throw new Error('No visual generation method enabled');
          }

          // Update segment in database
          await prisma.longFormSegment.update({
            where: { id: segment.id },
            data: {
              visualType,
              assetUrl,
              status: 'COMPLETED',
            },
          });

          log.info({ segmentIndex: globalIndex, visualType }, 'Segment processed');

          return {
            ...segment,
            visualType,
            assetUrl,
          } as ProcessedSegment;
        } catch (error) {
          log.error({ segmentIndex: globalIndex, err: error }, 'Segment processing failed');

          // Update segment status to failed
          await prisma.longFormSegment.update({
            where: { id: segment.id },
            data: {
              status: 'FAILED',
            },
          });

          // Use fallback static image
          const fallbackUrl = `https://via.placeholder.com/1280x720/EF4444/FFFFFF?text=Error`;
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

    // Brief delay between batches to respect API rate limits
    if (i + BATCH_SIZE < segments.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  log.info({ processedCount: processedSegments.length }, 'All segments processed');
  return processedSegments;
}
