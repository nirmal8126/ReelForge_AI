import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'gameplay-config-generator' });

// ---------------------------------------------------------------------------
// Clients (lazy-initialised)
// ---------------------------------------------------------------------------

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return openaiClient;
}

function getPreferredProvider(): 'anthropic' | 'openai' | 'auto' {
  const value = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (value === 'anthropic' || value === 'openai') return value;
  return 'auto';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemeColors {
  bg: string;
  primary: string;
  secondary: string;
  accent: string;
  obstacle: string;
  coin: string;
  text: string;
}

export interface GameEvent {
  frame: number;
  type: 'obstacle' | 'coin' | 'powerup' | 'near_miss' | 'color_change' | 'speed_up';
  x: number;
  y: number;
  variant?: string;
}

export interface GameSegment {
  startFrame: number;
  endFrame: number;
  speed: number;       // multiplier: 1.0 = base, 2.0 = double
  obstacleFrequency: number; // obstacles per second
}

export interface GameConfig {
  fps: number;
  totalFrames: number;
  duration: number;
  width: number;
  height: number;
  template: string;
  difficulty: string;
  theme: ThemeColors;
  events: GameEvent[];
  scoreProgression: number[];
  segments: GameSegment[];
  gameTitle?: string;
  showScore: boolean;
  ctaText?: string;
}

// ---------------------------------------------------------------------------
// Theme color palettes
// ---------------------------------------------------------------------------

export const THEMES: Record<string, ThemeColors> = {
  neon:   { bg: '#0A0A1A', primary: '#00F5FF', secondary: '#FF00FF', accent: '#FFD700', obstacle: '#FF4444', coin: '#FFD700', text: '#FFFFFF' },
  pastel: { bg: '#FFF5F5', primary: '#FFB3BA', secondary: '#BAFFC9', accent: '#BAE1FF', obstacle: '#FFB3BA', coin: '#FFE4B5', text: '#333333' },
  retro:  { bg: '#1A1A2E', primary: '#E94560', secondary: '#533483', accent: '#0F3460', obstacle: '#E94560', coin: '#F5A623', text: '#FFFFFF' },
  dark:   { bg: '#0D1117', primary: '#58A6FF', secondary: '#BC8CFF', accent: '#3FB950', obstacle: '#F85149', coin: '#D29922', text: '#E6EDF3' },
  candy:  { bg: '#FFE4E1', primary: '#FF6B9D', secondary: '#C44AFF', accent: '#51CF66', obstacle: '#FF6B6B', coin: '#FFD93D', text: '#2D2D2D' },
};

// ---------------------------------------------------------------------------
// Difficulty presets
// ---------------------------------------------------------------------------

const DIFFICULTY_PRESETS: Record<string, { baseSpeed: number; obstacleFreq: number; coinFreq: number; speedRamp: number }> = {
  easy:   { baseSpeed: 1.0, obstacleFreq: 0.8,  coinFreq: 1.5, speedRamp: 0.1 },
  medium: { baseSpeed: 1.3, obstacleFreq: 1.2,  coinFreq: 1.2, speedRamp: 0.2 },
  hard:   { baseSpeed: 1.7, obstacleFreq: 1.8,  coinFreq: 0.8, speedRamp: 0.3 },
  insane: { baseSpeed: 2.2, obstacleFreq: 2.5,  coinFreq: 0.5, speedRamp: 0.5 },
};

// ---------------------------------------------------------------------------
// Dimensions from aspect ratio
// ---------------------------------------------------------------------------

function getDimensions(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '16:9': return { width: 1920, height: 1080 };
    case '1:1':  return { width: 1080, height: 1080 };
    default:     return { width: 1080, height: 1920 }; // 9:16
  }
}

// ---------------------------------------------------------------------------
// Procedural config generation (DEV_MODE fallback)
// ---------------------------------------------------------------------------

function generateProceduralConfig(
  template: string,
  theme: string,
  difficulty: string,
  duration: number,
  aspectRatio: string,
  gameTitle?: string,
  showScore = true,
  ctaText?: string,
): GameConfig {
  const fps = 30;
  const totalFrames = duration * fps;
  const { width, height } = getDimensions(aspectRatio);
  const themeColors = THEMES[theme] || THEMES.neon;
  const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.medium;

  // Generate segments (difficulty curve)
  const segmentCount = Math.max(3, Math.floor(duration / 10));
  const framesPerSegment = Math.floor(totalFrames / segmentCount);
  const segments: GameSegment[] = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      startFrame: i * framesPerSegment,
      endFrame: i === segmentCount - 1 ? totalFrames : (i + 1) * framesPerSegment,
      speed: preset.baseSpeed + (preset.speedRamp * i),
      obstacleFrequency: preset.obstacleFreq + (i * 0.3),
    });
  }

  // Generate events
  const events: GameEvent[] = [];
  let score = 0;
  const scoreProgression: number[] = [];
  const seed = template.length + duration + difficulty.length; // simple deterministic seed

  for (let sec = 0; sec < duration; sec++) {
    const segIndex = Math.min(Math.floor(sec / (duration / segmentCount)), segmentCount - 1);
    const seg = segments[segIndex];

    // Obstacles
    const obstaclesThisSecond = Math.round(seg.obstacleFrequency);
    for (let o = 0; o < obstaclesThisSecond; o++) {
      const frame = sec * fps + Math.floor((o + 1) * (fps / (obstaclesThisSecond + 1)));
      const variants = template === 'COLOR_SWITCH' ? ['red', 'blue', 'green', 'yellow'] : ['block', 'spike', 'wall'];
      events.push({
        frame,
        type: 'obstacle',
        x: ((seed + sec * 7 + o * 13) % 80) + 10, // 10-90% of width
        y: ((seed + sec * 11 + o * 17) % 60) + 20, // 20-80% of height
        variant: variants[(seed + sec + o) % variants.length],
      });
    }

    // Coins
    const coinsThisSecond = Math.round(preset.coinFreq);
    for (let c = 0; c < coinsThisSecond; c++) {
      const frame = sec * fps + Math.floor((c + 0.5) * (fps / (coinsThisSecond + 1)));
      events.push({
        frame,
        type: 'coin',
        x: ((seed + sec * 19 + c * 23) % 70) + 15,
        y: ((seed + sec * 29 + c * 31) % 50) + 25,
      });
      score += 10;
    }

    // Near-miss events (every 3-5 seconds for excitement)
    if (sec > 2 && sec % (4 - Math.min(2, segIndex)) === 0) {
      events.push({
        frame: sec * fps + Math.floor(fps / 2),
        type: 'near_miss',
        x: 50,
        y: 50,
      });
      score += 25;
    }

    // Speed-up at segment boundaries
    if (sec > 0 && sec % Math.floor(duration / segmentCount) === 0) {
      events.push({
        frame: sec * fps,
        type: 'speed_up',
        x: 50,
        y: 50,
      });
    }

    // Color change events for COLOR_SWITCH template
    if (template === 'COLOR_SWITCH' && sec % 3 === 0) {
      events.push({
        frame: sec * fps,
        type: 'color_change',
        x: 50,
        y: 50,
        variant: ['red', 'blue', 'green', 'yellow'][(seed + sec) % 4],
      });
    }

    scoreProgression.push(score);
  }

  // Sort events by frame
  events.sort((a, b) => a.frame - b.frame);

  return {
    fps,
    totalFrames,
    duration,
    width,
    height,
    template,
    difficulty,
    theme: themeColors,
    events,
    scoreProgression,
    segments,
    gameTitle,
    showScore,
    ctaText,
  };
}

// ---------------------------------------------------------------------------
// AI prompt builder
// ---------------------------------------------------------------------------

function buildConfigPrompt(
  template: string,
  difficulty: string,
  duration: number,
  width: number,
  height: number,
): string {
  const fps = 30;
  const totalFrames = duration * fps;
  const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.medium;

  return `You are a game designer creating the event timeline for a satisfying "${template.replace(/_/g, ' ').toLowerCase()}" gameplay animation video.

Video specs: ${width}x${height} at ${fps}fps, ${duration} seconds (${totalFrames} frames total).
Difficulty: ${difficulty} (base speed ${preset.baseSpeed}x, ~${preset.obstacleFreq} obstacles/sec)

Generate a JSON object with ONLY an "events" array. Each event:
- frame: integer (0 to ${totalFrames - 1})
- type: "obstacle" | "coin" | "near_miss" | "speed_up"${template === 'COLOR_SWITCH' ? ' | "color_change"' : ''}
- x: number (0-100, percentage of width)
- y: number (0-100, percentage of height)
- variant: optional string${template === 'COLOR_SWITCH' ? ' ("red","blue","green","yellow" for obstacles/color_change)' : ' ("block","spike","wall" for obstacles)'}

Rules:
- Place ~${Math.round(preset.obstacleFreq * duration)} obstacles total, increasing density over time
- Place ~${Math.round(preset.coinFreq * duration)} coins, spread evenly but avoiding obstacle positions
- Add ${Math.round(duration / 4)} "near_miss" events for excitement (close calls with obstacles)
- Add ${Math.max(2, Math.floor(duration / 10))} "speed_up" events at even intervals
${template === 'COLOR_SWITCH' ? `- Add color_change every 3-4 seconds with variant being the new ball color\n- Obstacles should alternate between colors, matching or not matching the ball` : ''}
- Events should create a satisfying, watchable gameplay flow
- Difficulty should ramp up gradually — easier first 30%, harder last 30%
- Ensure good spacing: no two obstacles within 5 frames of each other at similar positions

Return ONLY valid JSON: {"events": [...]}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateGameConfig(
  template: string,
  theme: string,
  difficulty: string,
  duration: number,
  aspectRatio: string,
  gameTitle?: string,
  showScore = true,
  ctaText?: string,
): Promise<GameConfig> {
  const fps = 30;
  const totalFrames = duration * fps;
  const { width, height } = getDimensions(aspectRatio);
  const themeColors = THEMES[theme] || THEMES.neon;

  // DEV_MODE: return procedural config
  if (process.env.DEV_MODE === 'true') {
    log.info({ template, theme, difficulty, duration }, 'DEV_MODE: Generating procedural game config');
    return generateProceduralConfig(template, theme, difficulty, duration, aspectRatio, gameTitle, showScore, ctaText);
  }

  const prompt = buildConfigPrompt(template, difficulty, duration, width, height);
  const provider = getPreferredProvider();
  const providers =
    provider === 'auto'
      ? ['anthropic', 'openai']
      : [provider, ...(provider !== 'anthropic' ? ['anthropic'] : []), ...(provider !== 'openai' ? ['openai'] : [])];

  log.info({ template, theme, difficulty, duration, provider }, 'Generating gameplay config via AI');

  for (const p of providers) {
    try {
      let responseText: string;

      if (p === 'anthropic') {
        const client = getAnthropicClient();
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        });
        responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      } else if (p === 'openai') {
        const client = getOpenAIClient();
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        });
        responseText = response.choices[0]?.message?.content || '';
      } else {
        continue;
      }

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { events: GameEvent[] };
        if (parsed.events && Array.isArray(parsed.events) && parsed.events.length >= 5) {
          log.info({ provider: p, eventCount: parsed.events.length }, 'Game config generated via AI');

          // Build full config from AI events
          const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.medium;
          const segmentCount = Math.max(3, Math.floor(duration / 10));
          const framesPerSegment = Math.floor(totalFrames / segmentCount);
          const segments: GameSegment[] = [];
          for (let i = 0; i < segmentCount; i++) {
            segments.push({
              startFrame: i * framesPerSegment,
              endFrame: i === segmentCount - 1 ? totalFrames : (i + 1) * framesPerSegment,
              speed: preset.baseSpeed + (preset.speedRamp * i),
              obstacleFrequency: preset.obstacleFreq + (i * 0.3),
            });
          }

          // Build score progression from events
          let score = 0;
          const scoreProgression: number[] = [];
          for (let sec = 0; sec < duration; sec++) {
            const frameStart = sec * fps;
            const frameEnd = (sec + 1) * fps;
            const secEvents = parsed.events.filter(e => e.frame >= frameStart && e.frame < frameEnd);
            for (const e of secEvents) {
              if (e.type === 'coin') score += 10;
              if (e.type === 'near_miss') score += 25;
            }
            scoreProgression.push(score);
          }

          return {
            fps,
            totalFrames,
            duration,
            width,
            height,
            template,
            difficulty,
            theme: themeColors,
            events: parsed.events.sort((a, b) => a.frame - b.frame),
            scoreProgression,
            segments,
            gameTitle,
            showScore,
            ctaText,
          };
        }
      }

      log.warn({ provider: p, responseText: responseText.substring(0, 200) }, 'Failed to parse game config from AI');
    } catch (err) {
      log.warn({ provider: p, err }, 'Game config generation failed, trying next...');
    }
  }

  // Final fallback to procedural
  log.warn('All AI providers failed, returning procedural game config');
  return generateProceduralConfig(template, theme, difficulty, duration, aspectRatio, gameTitle, showScore, ctaText);
}
