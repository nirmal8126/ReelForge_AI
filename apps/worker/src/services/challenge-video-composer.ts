import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';
import { ChallengeQuestion } from './challenge-content-generator';

const execFileAsync = promisify(execFile);

const log = logger.child({ service: 'challenge-video-composer' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComposeChallengeOptions {
  questions: ChallengeQuestion[];
  ctaText: string;
  challengeType: string;
  timerSeconds: number;
  templateStyle: string;
  audioBuffer?: Buffer;  // optional voiceover
}

// ---------------------------------------------------------------------------
// Template colour schemes
// ---------------------------------------------------------------------------

interface TemplateColors {
  bg: string;
  text: string;
  accent: string;
  hookBg: string;
  answerBg: string;
  timerColor: string;
}

const TEMPLATE_COLORS: Record<string, TemplateColors> = {
  neon: {
    bg: '#0A0A1A',
    text: '#FFFFFF',
    accent: '#00F5FF',
    hookBg: '#1A0A2E',
    answerBg: '#0A1A0A',
    timerColor: '#FFD700',
  },
  minimal: {
    bg: '#1A1A2E',
    text: '#F0F0F0',
    accent: '#64748B',
    hookBg: '#16213E',
    answerBg: '#1A2E1A',
    timerColor: '#F59E0B',
  },
  gameshow: {
    bg: '#1E0A3C',
    text: '#FFFFFF',
    accent: '#F59E0B',
    hookBg: '#2E1A00',
    answerBg: '#002E0A',
    timerColor: '#FF4444',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToFFmpeg(hex: string): string {
  // FFmpeg expects colors as hex without #
  return hex.replace('#', '');
}

function escapeFFmpegText(text: string): string {
  // Escape special chars for FFmpeg drawtext
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function wrapText(text: string, maxCharsPerLine: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxCharsPerLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Generate a slide (raw FFmpeg command → MP4 segment)
// ---------------------------------------------------------------------------

async function generateSlide(opts: {
  tmpDir: string;
  slideIndex: number;
  duration: number;
  bgColor: string;
  lines: Array<{ text: string; y: string; fontSize: number; color: string; fontWeight?: string }>;
  width: number;
  height: number;
}): Promise<string> {
  const { tmpDir, slideIndex, duration, bgColor, lines, width, height } = opts;
  const outputPath = path.join(tmpDir, `slide_${slideIndex}.mp4`);

  // Build drawtext filters for each line
  const drawFilters = lines.map((line) => {
    const escaped = escapeFFmpegText(line.text);
    return `drawtext=text='${escaped}':fontcolor=0x${hexToFFmpeg(line.color)}:fontsize=${line.fontSize}:x=(w-text_w)/2:y=${line.y}`;
  });

  const vfArg = drawFilters.length > 0 ? drawFilters.join(',') : 'null';

  // Use raw ffmpeg command for reliable lavfi input
  const args = [
    '-f', 'lavfi',
    '-i', `color=c=0x${hexToFFmpeg(bgColor)}:s=${width}x${height}:d=${duration}:r=30`,
    '-vf', vfArg,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-pix_fmt', 'yuv420p',
    '-t', String(duration),
    '-y',
    outputPath,
  ];

  try {
    await execFileAsync('ffmpeg', args, { timeout: 30000 });
    return outputPath;
  } catch (err) {
    log.error({ err, slideIndex, args: args.join(' ') }, 'Failed to generate slide');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Build slides for a single question
// ---------------------------------------------------------------------------

function buildQuestionSlides(
  question: ChallengeQuestion,
  challengeType: string,
  timerSeconds: number,
  colors: TemplateColors,
  questionIndex: number,
  totalQuestions: number,
): Array<{
  duration: number;
  bgColor: string;
  lines: Array<{ text: string; y: string; fontSize: number; color: string; fontWeight?: string }>;
}> {
  const slides: Array<{
    duration: number;
    bgColor: string;
    lines: Array<{ text: string; y: string; fontSize: number; color: string; fontWeight?: string }>;
  }> = [];

  const qNum = totalQuestions > 1 ? `#${questionIndex + 1}` : '';

  // --- HOOK SLIDE (2-3s) ---
  slides.push({
    duration: 3,
    bgColor: colors.hookBg,
    lines: [
      { text: question.hookText, y: '(h-text_h)/2-40', fontSize: 42, color: colors.accent, fontWeight: 'bold' },
      ...(qNum ? [{ text: `Question ${qNum}`, y: '(h-text_h)/2+40', fontSize: 24, color: colors.text }] : []),
    ],
  });

  // --- QUESTION SLIDE (4-5s) ---
  const questionLines: Array<{ text: string; y: string; fontSize: number; color: string; fontWeight?: string }> = [];

  if (challengeType === 'emoji_guess' && question.emojis) {
    questionLines.push({ text: question.emojis, y: '(h-text_h)/2-80', fontSize: 64, color: colors.text });
    questionLines.push({ text: wrapText(question.question, 30), y: '(h-text_h)/2+40', fontSize: 28, color: colors.text });
  } else if (challengeType === 'gk_quiz' && question.options) {
    questionLines.push({ text: wrapText(question.question, 28), y: 'h*0.15', fontSize: 30, color: colors.text, fontWeight: 'bold' });
    question.options.forEach((opt, i) => {
      const labels = ['A', 'B', 'C', 'D'];
      questionLines.push({ text: `${labels[i]}) ${opt}`, y: `h*${0.35 + i * 0.12}`, fontSize: 26, color: colors.accent });
    });
  } else if (challengeType === 'would_you_rather') {
    questionLines.push({ text: wrapText(question.question, 30), y: 'h*0.15', fontSize: 28, color: colors.text });
    if (question.optionA) questionLines.push({ text: `A: ${wrapText(question.optionA, 25)}`, y: 'h*0.35', fontSize: 30, color: '#22C55E', fontWeight: 'bold' });
    questionLines.push({ text: 'OR', y: 'h*0.50', fontSize: 36, color: colors.accent, fontWeight: 'bold' });
    if (question.optionB) questionLines.push({ text: `B: ${wrapText(question.optionB, 25)}`, y: 'h*0.65', fontSize: 30, color: '#EF4444', fontWeight: 'bold' });
  } else {
    // riddle, math — just show the question text
    questionLines.push({ text: wrapText(question.question, 28), y: '(h-text_h)/2', fontSize: 34, color: colors.text, fontWeight: 'bold' });
  }

  slides.push({
    duration: 4,
    bgColor: colors.bg,
    lines: questionLines,
  });

  // --- COUNTDOWN SLIDE (timerSeconds) ---
  // We create one static "THINK!" slide since animated countdown requires frame-by-frame
  // The actual timer overlay will be added via drawtext expression in the final compose
  slides.push({
    duration: timerSeconds,
    bgColor: colors.bg,
    lines: [
      { text: `${timerSeconds}s`, y: '(h-text_h)/2-20', fontSize: 72, color: colors.timerColor, fontWeight: 'bold' },
      { text: 'TIME IS RUNNING!', y: '(h-text_h)/2+60', fontSize: 24, color: colors.text },
    ],
  });

  // --- REVEAL SLIDE (3-4s) ---
  const revealLines: Array<{ text: string; y: string; fontSize: number; color: string; fontWeight?: string }> = [
    { text: 'ANSWER', y: 'h*0.20', fontSize: 28, color: colors.accent },
    { text: wrapText(question.answer, 25), y: '(h-text_h)/2', fontSize: 40, color: '#22C55E', fontWeight: 'bold' },
  ];

  if (question.explanation) {
    revealLines.push({ text: wrapText(question.explanation, 35), y: 'h*0.70', fontSize: 22, color: colors.text });
  }

  slides.push({
    duration: 4,
    bgColor: colors.answerBg,
    lines: revealLines,
  });

  return slides;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function composeChallengeVideo(opts: ComposeChallengeOptions): Promise<Buffer> {
  const { questions, ctaText, challengeType, timerSeconds, templateStyle, audioBuffer } = opts;

  const colors = TEMPLATE_COLORS[templateStyle] || TEMPLATE_COLORS.neon;
  const width = 1080;
  const height = 1920; // 9:16 vertical

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reelforge-challenge-'));

  try {
    log.info({ tmpDir, questionCount: questions.length, templateStyle }, 'Composing challenge video');

    // Build all slides
    const allSlides: Array<{
      duration: number;
      bgColor: string;
      lines: Array<{ text: string; y: string; fontSize: number; color: string; fontWeight?: string }>;
    }> = [];

    for (let i = 0; i < questions.length; i++) {
      const questionSlides = buildQuestionSlides(
        questions[i], challengeType, timerSeconds, colors, i, questions.length,
      );
      allSlides.push(...questionSlides);
    }

    // CTA slide at the end
    allSlides.push({
      duration: 3,
      bgColor: colors.hookBg,
      lines: [
        { text: wrapText(ctaText, 25), y: '(h-text_h)/2-20', fontSize: 32, color: colors.accent, fontWeight: 'bold' },
        { text: 'FOLLOW FOR MORE!', y: 'h*0.70', fontSize: 24, color: colors.text },
      ],
    });

    // Generate each slide as a video segment
    const slidePaths: string[] = [];
    for (let i = 0; i < allSlides.length; i++) {
      const slide = allSlides[i];
      const slidePath = await generateSlide({
        tmpDir,
        slideIndex: i,
        duration: slide.duration,
        bgColor: slide.bgColor,
        lines: slide.lines,
        width,
        height,
      });
      slidePaths.push(slidePath);
    }

    log.info({ slideCount: slidePaths.length }, 'All slides generated, concatenating');

    // Create concat file
    const concatFilePath = path.join(tmpDir, 'concat.txt');
    const concatContent = slidePaths.map((p) => `file '${p}'`).join('\n');
    await fs.promises.writeFile(concatFilePath, concatContent);

    // Concatenate all slides using raw ffmpeg
    const concatOutputPath = path.join(tmpDir, 'concatenated.mp4');
    await execFileAsync('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFilePath,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-y',
      concatOutputPath,
    ], { timeout: 120000 });

    // If we have audio, overlay it
    let finalPath = concatOutputPath;

    if (audioBuffer && audioBuffer.length > 0) {
      const audioPath = path.join(tmpDir, 'voiceover.mp3');
      await fs.promises.writeFile(audioPath, audioBuffer);

      finalPath = path.join(tmpDir, 'final.mp4');
      await execFileAsync('ffmpeg', [
        '-i', concatOutputPath,
        '-i', audioPath,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        '-y',
        finalPath,
      ], { timeout: 120000 });
    }

    // Read final video
    const videoBuffer = await fs.promises.readFile(finalPath);
    log.info({ sizeBytes: videoBuffer.length }, 'Challenge video composed');

    return videoBuffer;
  } finally {
    // Cleanup temp directory
    try {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    } catch {
      log.warn({ tmpDir }, 'Failed to cleanup temp dir');
    }
  }
}
