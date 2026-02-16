import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'cartoon-composer' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CartoonSceneInput {
  sceneIndex: number;
  imageUrl: string; // local file path or URL
  durationSeconds: number;
  subtitleLines: { speaker: string; text: string; color?: string }[];
}

export interface ComposeCartoonOptions {
  scenes: CartoonSceneInput[];
  audioBuffer: Buffer;
  aspectRatio: string;
}

// ---------------------------------------------------------------------------
// Resolution map
// ---------------------------------------------------------------------------

const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compose a cartoon episode from scene images + audio into a final MP4.
 *
 * 1. For each scene: apply Ken Burns effect on the image for its duration
 * 2. Concatenate all scene videos
 * 3. Overlay the full audio track
 * 4. Output final MP4 buffer
 */
export async function composeCartoonEpisode(opts: ComposeCartoonOptions): Promise<Buffer> {
  const { scenes, audioBuffer, aspectRatio } = opts;
  const res = RESOLUTION_MAP[aspectRatio] || RESOLUTION_MAP['16:9'];
  const tmpDir = path.join(os.tmpdir(), `cartoon-compose-${Date.now()}`);

  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Save audio to temp file
    const audioPath = path.join(tmpDir, 'audio.mp3');
    fs.writeFileSync(audioPath, audioBuffer);

    const sceneVideos: string[] = [];

    // Stage 1: Generate video for each scene (Ken Burns on image)
    for (const scene of scenes) {
      const sceneVideo = path.join(tmpDir, `scene-${scene.sceneIndex}.mp4`);
      await generateSceneVideo(scene, sceneVideo, res, tmpDir);
      sceneVideos.push(sceneVideo);
    }

    // Stage 2: Concatenate all scene videos
    const concatList = path.join(tmpDir, 'concat.txt');
    const concatContent = sceneVideos.map((v) => `file '${v}'`).join('\n');
    fs.writeFileSync(concatList, concatContent);

    const concatenated = path.join(tmpDir, 'concatenated.mp4');
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${concatenated}"`,
      { timeout: 120_000, stdio: 'pipe' }
    );

    // Stage 3: Overlay audio
    const output = path.join(tmpDir, 'output.mp4');
    execSync(
      `ffmpeg -y -i "${concatenated}" -i "${audioPath}" ` +
      `-map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k ` +
      `-shortest -movflags +faststart "${output}"`,
      { timeout: 120_000, stdio: 'pipe' }
    );

    const buffer = fs.readFileSync(output);
    log.info({ sceneCount: scenes.length, outputSize: buffer.length }, 'Cartoon episode composed');
    return buffer;
  } finally {
    // Cleanup temp dir
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Ken Burns scene video generation
// ---------------------------------------------------------------------------

/**
 * Generate a video from a static image with Ken Burns effect (slow zoom).
 * Alternates between zoom-in, zoom-out, and pan effects for variety.
 */
async function generateSceneVideo(
  scene: CartoonSceneInput,
  outputPath: string,
  res: { width: number; height: number },
  tmpDir: string,
): Promise<void> {
  const { imageUrl, durationSeconds, sceneIndex } = scene;
  const duration = Math.max(3, Math.round(durationSeconds));

  // Determine image source
  let imagePath: string;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // Download remote image
    imagePath = path.join(tmpDir, `img-${sceneIndex}.png`);
    execSync(`curl -sL -o "${imagePath}" "${imageUrl}"`, { timeout: 30_000, stdio: 'pipe' });
  } else if (imageUrl.startsWith('file://')) {
    imagePath = imageUrl.replace('file://', '');
  } else {
    imagePath = imageUrl;
  }

  // Check if image exists — generate placeholder if not
  if (!fs.existsSync(imagePath)) {
    imagePath = path.join(tmpDir, `placeholder-${sceneIndex}.ppm`);
    generatePlaceholderImage(imagePath, res, sceneIndex);
  }

  // Ken Burns effect — alternate between zoom types
  const effects = ['zoom_in', 'zoom_out', 'pan_right'];
  const effect = effects[sceneIndex % effects.length];

  // zoompan filter: z = zoom factor, d = duration in frames, s = output size
  const fps = 30;
  const totalFrames = duration * fps;
  let zoompanFilter: string;

  switch (effect) {
    case 'zoom_in':
      // Slow zoom in from 1.0x to 1.2x
      zoompanFilter = `zoompan=z='min(zoom+0.0003,1.2)':d=${totalFrames}:s=${res.width}x${res.height}:fps=${fps}`;
      break;
    case 'zoom_out':
      // Start at 1.2x, zoom out to 1.0x
      zoompanFilter = `zoompan=z='if(eq(on,1),1.2,max(zoom-0.0003,1.0))':d=${totalFrames}:s=${res.width}x${res.height}:fps=${fps}`;
      break;
    case 'pan_right':
      // Pan from left to right at 1.1x zoom
      zoompanFilter = `zoompan=z='1.1':x='iw/2-(iw/zoom/2)+on*0.5':d=${totalFrames}:s=${res.width}x${res.height}:fps=${fps}`;
      break;
    default:
      zoompanFilter = `zoompan=z='min(zoom+0.0003,1.2)':d=${totalFrames}:s=${res.width}x${res.height}:fps=${fps}`;
  }

  execSync(
    `ffmpeg -y -loop 1 -i "${imagePath}" ` +
    `-vf "${zoompanFilter}" ` +
    `-t ${duration} -c:v libx264 -preset fast -pix_fmt yuv420p ` +
    `-r ${fps} "${outputPath}"`,
    { timeout: 60_000, stdio: 'pipe' }
  );

  log.debug({ sceneIndex, duration, effect }, 'Scene video generated');
}

// ---------------------------------------------------------------------------
// Placeholder image (solid color with text)
// ---------------------------------------------------------------------------

function generatePlaceholderImage(
  outputPath: string,
  res: { width: number; height: number },
  sceneIndex: number,
): void {
  // Generate a PPM image with a gradient-like color based on scene index
  const colors = [
    [99, 102, 241],   // Indigo
    [168, 85, 247],   // Purple
    [59, 130, 246],   // Blue
    [16, 185, 129],   // Green
    [245, 158, 11],   // Amber
    [239, 68, 68],    // Red
    [236, 72, 153],   // Pink
    [6, 182, 212],    // Cyan
  ];
  const [r, g, b] = colors[sceneIndex % colors.length];

  // PPM P6 format
  const header = `P6\n${res.width} ${res.height}\n255\n`;
  const headerBuf = Buffer.from(header, 'ascii');
  const pixelCount = res.width * res.height;
  const pixelData = Buffer.alloc(pixelCount * 3);

  for (let i = 0; i < pixelCount; i++) {
    pixelData[i * 3] = r;
    pixelData[i * 3 + 1] = g;
    pixelData[i * 3 + 2] = b;
  }

  fs.writeFileSync(outputPath, Buffer.concat([headerBuf, pixelData]));
}
