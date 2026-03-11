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
  imageUrl: string; // local file path or URL (primary/first image)
  imageUrls?: string[]; // multiple image paths for the scene
  videoClipPath?: string; // optional pre-generated AI video clip (replaces Ken Burns)
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

    log.info({ audioSize: audioBuffer.length }, 'Audio buffer written to temp file');

    // Verify audio file is valid via ffprobe
    try {
      const probeOut = execSync(
        `ffprobe -v error -show_entries format=duration,format_name -of json "${audioPath}"`,
        { timeout: 10_000, stdio: 'pipe', maxBuffer: 1024 * 1024 },
      ).toString();
      log.info({ audioProbe: JSON.parse(probeOut).format }, 'Cartoon audio probe');
    } catch (probeErr: any) {
      log.warn({ err: probeErr.message }, 'Cartoon audio probe failed — file may be invalid');
    }

    const sceneVideos: string[] = [];

    // Stage 1: Generate video for each scene
    // If scene has a pre-generated AI video clip, use it directly
    // Otherwise split across multiple images with Ken Burns effect
    let subClipIndex = 0;
    for (const scene of scenes) {
      if (scene.videoClipPath && fs.existsSync(scene.videoClipPath)) {
        // Use AI-generated video clip directly — scale to target resolution
        const clipPath = path.join(tmpDir, `clip-${subClipIndex}.mp4`);
        execSync(
          `ffmpeg -y -i "${scene.videoClipPath}" -t ${scene.durationSeconds} ` +
          `-vf "scale=${res.width}:${res.height}:force_original_aspect_ratio=decrease,pad=${res.width}:${res.height}:(ow-iw)/2:(oh-ih)/2:black" ` +
          `-c:v libx264 -preset veryfast -pix_fmt yuv420p -an "${clipPath}"`,
          { timeout: 60_000, stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 },
        );
        sceneVideos.push(clipPath);
        log.info({ sceneIndex: scene.sceneIndex }, 'Using AI video clip for scene');
        subClipIndex++;
      } else {
        // Ken Burns on images
        const images = (scene.imageUrls && scene.imageUrls.length > 1) ? scene.imageUrls : [scene.imageUrl];
        const perImageDuration = Math.max(3, Math.round(scene.durationSeconds / images.length));

        for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
          const subScene: CartoonSceneInput = {
            sceneIndex: subClipIndex,
            imageUrl: images[imgIdx],
            durationSeconds: perImageDuration,
            subtitleLines: imgIdx === 0 ? scene.subtitleLines : [], // subtitles on first image only
          };
          const clipPath = path.join(tmpDir, `clip-${subClipIndex}.mp4`);
          await generateSceneVideo(subScene, clipPath, res, tmpDir);
          sceneVideos.push(clipPath);
          subClipIndex++;
        }
      }
    }

    // Stage 2: Concatenate all scene videos
    const concatList = path.join(tmpDir, 'concat.txt');
    const concatContent = sceneVideos.map((v) => `file '${v}'`).join('\n');
    fs.writeFileSync(concatList, concatContent);

    const concatenated = path.join(tmpDir, 'concatenated.mp4');
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${concatenated}"`,
      { timeout: 180_000, stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 }
    );

    // Stage 3: Overlay audio
    const output = path.join(tmpDir, 'output.mp4');
    execSync(
      `ffmpeg -y -i "${concatenated}" -i "${audioPath}" ` +
      `-map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k ` +
      `-shortest -movflags +faststart "${output}"`,
      { timeout: 180_000, stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 }
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
    execSync(`curl -sL -o "${imagePath}" "${imageUrl}"`, { timeout: 30_000, stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 });
  } else if (imageUrl.startsWith('file://')) {
    imagePath = imageUrl.replace('file://', '');
  } else {
    imagePath = imageUrl;
  }

  // Check if image exists — generate placeholder if not
  if (!fs.existsSync(imagePath)) {
    imagePath = path.join(tmpDir, `placeholder-${sceneIndex}.png`);
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
    { timeout: 120_000, stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 }
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
  const colors = [
    '6366F1', 'A855F7', '3B82F6', '10B981',
    'F59E0B', 'EF4444', 'EC4899', '06B6D4',
  ];
  const color = colors[sceneIndex % colors.length];

  // Use FFmpeg to generate a small PNG placeholder (much lighter than raw PPM)
  try {
    execSync(
      `ffmpeg -y -f lavfi -i "color=c=0x${color}:s=${res.width}x${res.height}:d=1" -frames:v 1 "${outputPath}"`,
      { timeout: 10_000, stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 },
    );
  } catch {
    // Fallback: tiny 1x1 PPM that FFmpeg will scale
    const header = `P6\n1 1\n255\n`;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    fs.writeFileSync(outputPath, Buffer.concat([Buffer.from(header, 'ascii'), Buffer.from([r, g, b])]));
  }
}
