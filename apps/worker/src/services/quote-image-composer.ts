import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'quote-image-composer' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuoteComposeOptions {
  quoteText: string;
  author: string;
  bgType: 'gradient' | 'stock' | 'ai';
  bgValue?: string; // gradient CSS colors OR stock image path OR ai image path
  textColor: string;
  fontStyle: string; // serif | sans | handwritten | bold
  aspectRatio: string; // 1:1 | 9:16 | 16:9
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get pixel dimensions from aspect ratio string. */
function getDimensions(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '16:9':
      return { width: 1920, height: 1080 };
    default:
      return { width: 1080, height: 1080 }; // 1:1
  }
}

/** Map font style name to FFmpeg font family. */
function getFontFamily(fontStyle: string): string {
  switch (fontStyle) {
    case 'sans':
      return 'Arial';
    case 'handwritten':
      return 'Georgia'; // fallback since cursive not always available
    case 'bold':
      return 'Arial-Bold';
    default:
      return 'Georgia'; // serif
  }
}

/** Parse gradient colors from bgValue (format: "#color1,#color2" or raw hex). */
function parseGradientColors(bgValue?: string): [string, string] {
  if (!bgValue) return ['232526', '414345']; // default dark gradient
  // Handle "#FF6B6B,#FFE66D" format
  const colors = bgValue.replace(/[#\s]/g, '').split(',');
  if (colors.length >= 2) return [colors[0], colors[1]];
  return ['232526', '414345'];
}

/** Escape text for FFmpeg drawtext filter. */
function escapeText(t: string): string {
  return t
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%');
}

/**
 * Word-wrap text to fit within a given pixel width.
 * Estimates character width as ~0.55 × fontSize for proportional fonts.
 */
function wrapText(text: string, fontSize: number, maxWidth: number): string {
  const avgCharWidth = fontSize * 0.55;
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > maxCharsPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Image Composition
// ---------------------------------------------------------------------------

/**
 * Compose a quote image using FFmpeg.
 * Creates a background (gradient or image) with text overlay.
 */
export async function composeQuoteImage(opts: QuoteComposeOptions): Promise<Buffer> {
  const { quoteText, author, bgType, bgValue, textColor, fontStyle, aspectRatio } = opts;
  const { width, height } = getDimensions(aspectRatio);
  const tmpDir = path.join(os.tmpdir(), `quote-img-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const outputFile = path.join(tmpDir, 'quote.png');
  const font = getFontFamily(fontStyle);
  const color = textColor.replace('#', '');

  // Font sizes based on dimensions
  const quoteFontSize = Math.round(width * 0.045); // ~48px for 1080
  const authorFontSize = Math.round(width * 0.03); // ~32px for 1080
  const lineSpacing = Math.round(quoteFontSize * 0.4);

  // Word-wrap the quote text — use 70% of width as max text area
  const maxTextWidth = Math.round(width * 0.7);
  const wrappedQuote = wrapText(quoteText, quoteFontSize, maxTextWidth);
  const lineCount = wrappedQuote.split('\n').length;

  // Estimate total text block height for proper vertical centering
  const quoteBlockHeight = lineCount * (quoteFontSize + lineSpacing);
  const gap = Math.round(quoteFontSize * 0.6); // gap between quote and author
  const totalBlockHeight = quoteBlockHeight + gap + authorFontSize;

  // Y positions: center the entire block (quote + author) vertically
  const quoteY = `(h-${totalBlockHeight})/2`;
  const authorY = `(h-${totalBlockHeight})/2+${quoteBlockHeight}+${gap}`;

  const escapedQuote = escapeText(wrappedQuote);
  const escapedAuthor = escapeText(`— ${author}`);

  // Build drawtext filters with shadow for readability
  const quoteDrawtext = [
    `drawtext=text='${escapedQuote}'`,
    `font='${font}'`,
    `fontsize=${quoteFontSize}`,
    `fontcolor=0x${color}`,
    `x=(w-text_w)/2`,
    `y=${quoteY}`,
    `line_spacing=${lineSpacing}`,
    `shadowcolor=black@0.5`,
    `shadowx=2`,
    `shadowy=2`,
  ].join(':');

  const authorDrawtext = [
    `drawtext=text='${escapedAuthor}'`,
    `font='${font}'`,
    `fontsize=${authorFontSize}`,
    `fontcolor=0x${color}@0.8`,
    `x=(w-text_w)/2`,
    `y=${authorY}`,
    `shadowcolor=black@0.4`,
    `shadowx=1`,
    `shadowy=1`,
  ].join(':');

  try {
    const [c1] = parseGradientColors(bgValue);

    if ((bgType === 'stock' || bgType === 'ai') && bgValue && fs.existsSync(bgValue)) {
      // Use provided image as background with text overlay
      const cmd = [
        'ffmpeg -y',
        `-i "${bgValue}"`,
        `-vf "scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},${quoteDrawtext},${authorDrawtext}"`,
        `-frames:v 1`,
        `"${outputFile}"`,
      ].join(' ');

      log.info({ cmd: cmd.substring(0, 200) }, 'Composing quote image with background image');
      execSync(cmd, { timeout: 30_000, stdio: 'pipe' });
    } else {
      // Generate solid color background with text overlay
      const cmd = [
        'ffmpeg -y',
        `-f lavfi -i "color=c=0x${c1}:s=${width}x${height}:d=1,format=rgb24"`,
        `-vf "${quoteDrawtext},${authorDrawtext}"`,
        `-frames:v 1`,
        `"${outputFile}"`,
      ].join(' ');

      log.info({ cmd: cmd.substring(0, 200) }, 'Composing quote image with gradient background');
      execSync(cmd, { timeout: 30_000, stdio: 'pipe' });
    }

    const buffer = fs.readFileSync(outputFile);
    log.info({ sizeBytes: buffer.length, width, height }, 'Quote image composed');
    return buffer;
  } catch (err) {
    log.error({ err }, 'FFmpeg image composition failed, generating fallback');
    // Fallback: simple solid color image
    const fallbackCmd = `ffmpeg -y -f lavfi -i "color=c=0x1a1a2e:s=${width}x${height}:d=1" -frames:v 1 "${outputFile}"`;
    execSync(fallbackCmd, { timeout: 15_000, stdio: 'pipe' });
    const buffer = fs.readFileSync(outputFile);
    return buffer;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

