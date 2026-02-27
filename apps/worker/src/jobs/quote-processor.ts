import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';
import { generateQuoteVariations } from '../services/quote-text-generator';
import { generateHashtags } from '../services/hashtag-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuoteJobData {
  quoteJobId: string;
  userId: string;
  prompt: string;
  category: string;
  language: string;
  quoteLength?: string; // 'short' | 'medium' | 'long'
}

export interface QuoteJobResult {
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Main quote processing pipeline
// ---------------------------------------------------------------------------

/**
 * Quote processing pipeline — text-only.
 * Generates 5 quote variations using AI and saves them.
 */
export async function processQuoteJob(job: Job<QuoteJobData>): Promise<QuoteJobResult> {
  const startTime = Date.now();
  const { quoteJobId, prompt, category, language, quoteLength } = job.data;
  const log = logger.child({ quoteJobId, jobId: job.id });

  try {
    // ------------------------------------------------------------------
    // Generate 5 quote variations
    // ------------------------------------------------------------------
    log.info('Generating 5 quote variations');
    await updateStatus(quoteJobId, 'TEXT_GENERATING', 10, 'Generating quote variations...');
    await job.updateProgress(10);

    const variations = await generateQuoteVariations(category, language, prompt, quoteLength);

    // Store all variations as JSON, pick the first as the primary
    const variationsJson = JSON.stringify(variations);
    const selected = variations[0];

    await prisma.quoteJob.update({
      where: { id: quoteJobId },
      data: {
        quoteText: selected.quote,
        author: selected.author,
        quoteVariations: variationsJson,
      },
    });

    log.info({ count: variations.length, author: selected.author }, 'Quote variations generated');
    await job.updateProgress(90);

    // ------------------------------------------------------------------
    // Mark Complete
    // ------------------------------------------------------------------
    const processingTimeMs = Date.now() - startTime;

    const hashtags = await generateHashtags({
      title: selected.quote.substring(0, 80),
      prompt,
      category,
      language,
      module: 'quote',
    });

    await prisma.quoteJob.update({
      where: { id: quoteJobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        currentStage: null,
        processingTimeMs,
        completedAt: new Date(),
        hashtags,
      },
    });

    await job.updateProgress(100);
    log.info({ processingTimeMs }, 'Quote job completed');

    return { processingTimeMs };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ err: error, elapsedMs: elapsed }, 'Quote job failed');

    await prisma.quoteJob.update({
      where: { id: quoteJobId },
      data: {
        status: 'FAILED',
        errorMessage,
        processingTimeMs: elapsed,
      },
    });

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function updateStatus(
  quoteJobId: string,
  status: 'TEXT_GENERATING',
  progress: number,
  currentStage: string,
): Promise<void> {
  await prisma.quoteJob.update({
    where: { id: quoteJobId },
    data: { status, progress, currentStage },
  });
}
