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
  audioBuffer?: Buffer; // voiceover audio for video
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
    .replace(/:/g, '\\:');
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

  // Font size based on dimensions
  const quoteFontSize = Math.round(width * 0.045); // ~48px for 1080
  const authorFontSize = Math.round(width * 0.03); // ~32px for 1080

  const escapedQuote = escapeText(quoteText);
  const escapedAuthor = escapeText(`— ${author}`);

  try {
    const [c1] = parseGradientColors(bgValue);

    if ((bgType === 'stock' || bgType === 'ai') && bgValue && fs.existsSync(bgValue)) {
      // Use provided image as background with text overlay
      const cmd = [
        'ffmpeg -y',
        `-i "${bgValue}"`,
        `-vf "`,
        `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`,
        `,drawtext=text='${escapedQuote}':font='${font}':fontsize=${quoteFontSize}:fontcolor=0x${color}:x=(w-text_w)/2:y=(h-text_h)/2-${authorFontSize}:line_spacing=12`,
        `,drawtext=text='${escapedAuthor}':font='${font}':fontsize=${authorFontSize}:fontcolor=0x${color}@0.7:x=(w-text_w)/2:y=(h)/2+${quoteFontSize}+20`,
        `"`,
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
        `-vf "`,
        `drawtext=text='${escapedQuote}':font='${font}':fontsize=${quoteFontSize}:fontcolor=0x${color}:x=(w-text_w)/2:y=(h-text_h)/2-${authorFontSize}:line_spacing=12`,
        `,drawtext=text='${escapedAuthor}':font='${font}':fontsize=${authorFontSize}:fontcolor=0x${color}@0.7:x=(w-text_w)/2:y=(h)/2+${quoteFontSize}+20`,
        `"`,
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

// ---------------------------------------------------------------------------
// Video Composition
// ---------------------------------------------------------------------------

/**
 * Compose a quote video with Ken Burns animation + voiceover audio.
 */
export async function composeQuoteVideo(opts: QuoteComposeOptions): Promise<Buffer> {
  const { audioBuffer } = opts;
  const { width, height } = getDimensions(opts.aspectRatio);
  const tmpDir = path.join(os.tmpdir(), `quote-vid-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const imageFile = path.join(tmpDir, 'quote.png');
  const audioFile = path.join(tmpDir, 'audio.mp3');
  const outputFile = path.join(tmpDir, 'quote.mp4');

  try {
    // First compose the image
    const imageBuffer = await composeQuoteImage(opts);
    fs.writeFileSync(imageFile, imageBuffer);

    // Get audio duration for video length
    let duration = 5; // default 5 seconds
    if (audioBuffer && audioBuffer.length > 0) {
      fs.writeFileSync(audioFile, audioBuffer);
      // Get audio duration via ffprobe
      try {
        const probeResult = execSync(
          `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioFile}"`,
          { timeout: 10_000, stdio: 'pipe' },
        )
          .toString()
          .trim();
        const parsed = parseFloat(probeResult);
        if (!isNaN(parsed) && parsed > 0) {
          duration = Math.ceil(parsed) + 1; // add 1 sec padding
        }
      } catch {
        log.warn('Could not probe audio duration, using default');
      }
    }

    // Ken Burns zoompan effect: slow zoom in from 100% to 110% over duration
    const totalFrames = duration * 25; // 25fps
    const hasAudio = audioBuffer && audioBuffer.length > 0 && fs.existsSync(audioFile);

    const cmd = [
      'ffmpeg -y',
      `-loop 1 -i "${imageFile}"`,
      hasAudio ? `-i "${audioFile}"` : '',
      `-filter_complex "[0:v]zoompan=z='min(zoom+0.001,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=25[v]"`,
      `-map "[v]"`,
      hasAudio ? `-map 1:a -c:a aac -b:a 128k` : '',
      `-c:v libx264 -pix_fmt yuv420p -preset fast -crf 23`,
      `-t ${duration}`,
      `-shortest`,
      `"${outputFile}"`,
    ]
      .filter(Boolean)
      .join(' ');

    log.info({ duration, hasAudio, cmd: cmd.substring(0, 200) }, 'Composing quote video');
    execSync(cmd, { timeout: 120_000, stdio: 'pipe' });

    const buffer = fs.readFileSync(outputFile);
    log.info({ sizeBytes: buffer.length, duration }, 'Quote video composed');
    return buffer;
  } catch (err) {
    log.error({ err }, 'FFmpeg video composition failed');
    // Fallback: just create a simple video from color
    const fallbackCmd = `ffmpeg -y -f lavfi -i "color=c=0x1a1a2e:s=${width}x${height}:d=5:r=25" -c:v libx264 -pix_fmt yuv420p -t 5 "${outputFile}"`;
    execSync(fallbackCmd, { timeout: 30_000, stdio: 'pipe' });
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
