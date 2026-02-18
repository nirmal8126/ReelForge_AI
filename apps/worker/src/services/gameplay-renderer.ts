import { createCanvas, CanvasRenderingContext2D, Canvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import { GameConfig, GameEvent, ThemeColors } from './gameplay-config-generator';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'gameplay-renderer' });

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r},${g},${b})`;
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, opacity: number) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(0,0,0,${opacity})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const rgb = hexToRgb(color);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.6)`);
  gradient.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`);
  gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    const rgb = hexToRgb(p.color);
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateParticles(particles: Particle[]): Particle[] {
  return particles
    .map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.3, // gravity
      life: p.life - 1,
    }))
    .filter(p => p.life > 0);
}

function spawnParticles(x: number, y: number, color: string, count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 15 + Math.floor(Math.random() * 15),
      maxLife: 30,
      color,
      size: 3 + Math.random() * 4,
    });
  }
  return particles;
}

function drawScore(ctx: CanvasRenderingContext2D, score: number, x: number, y: number, theme: ThemeColors) {
  ctx.save();
  ctx.font = 'bold 42px "Arial", sans-serif';
  ctx.textAlign = 'right';
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(`${score}`, x + 2, y + 2);
  // Main
  ctx.fillStyle = theme.coin;
  ctx.fillText(`${score}`, x, y);
  ctx.restore();
}

function drawGameTitle(ctx: CanvasRenderingContext2D, title: string, width: number, theme: ThemeColors) {
  ctx.save();
  ctx.font = 'bold 36px "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillText(title, width / 2 + 2, 52);
  ctx.fillStyle = theme.text;
  ctx.fillText(title, width / 2, 50);
  ctx.restore();
}

function drawIsometricCube(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, color: string,
) {
  const rgb = hexToRgb(color);
  const top = `rgb(${Math.min(255, rgb.r + 40)},${Math.min(255, rgb.g + 40)},${Math.min(255, rgb.b + 40)})`;
  const right = `rgb(${Math.max(0, rgb.r - 30)},${Math.max(0, rgb.g - 30)},${Math.max(0, rgb.b - 30)})`;
  const left = `rgb(${Math.max(0, rgb.r - 60)},${Math.max(0, rgb.g - 60)},${Math.max(0, rgb.b - 60)})`;

  const s = size;
  const h = s * 0.5;

  // Top face
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - s, y);
  ctx.closePath();
  ctx.fill();

  // Left face
  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h + s);
  ctx.lineTo(x - s, y + s);
  ctx.closePath();
  ctx.fill();

  // Right face
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(x + s, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h + s);
  ctx.lineTo(x + s, y + s);
  ctx.closePath();
  ctx.fill();
}

function drawCTA(ctx: CanvasRenderingContext2D, text: string, width: number, height: number, theme: ThemeColors) {
  ctx.save();
  ctx.font = 'bold 28px "Arial", sans-serif';
  ctx.textAlign = 'center';
  const rgb = hexToRgb(theme.primary);
  ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`;
  const tw = ctx.measureText(text).width;
  ctx.fillRect(width / 2 - tw / 2 - 20, height - 80, tw + 40, 50);
  ctx.fillStyle = theme.primary;
  ctx.fillText(text, width / 2, height - 48);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Template: Endless Runner
// ---------------------------------------------------------------------------

function renderEndlessRunner(
  ctx: CanvasRenderingContext2D,
  frame: number,
  config: GameConfig,
  particles: Particle[],
): Particle[] {
  const { width, height, theme, events, fps } = config;
  const sec = frame / fps;
  const segIdx = config.segments.findIndex(s => frame >= s.startFrame && frame < s.endFrame);
  const seg = config.segments[Math.max(0, segIdx)];
  const speed = seg ? seg.speed : 1;

  // Background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);

  // Scrolling ground (isometric grid)
  const groundY = height * 0.65;
  const scrollOffset = (frame * speed * 4) % 60;

  // Draw ground gradient
  const grd = ctx.createLinearGradient(0, groundY - 50, 0, height);
  const bgRgb = hexToRgb(theme.bg);
  grd.addColorStop(0, theme.bg);
  grd.addColorStop(0.3, `rgba(${bgRgb.r + 15},${bgRgb.g + 15},${bgRgb.b + 15},1)`);
  grd.addColorStop(1, `rgba(${bgRgb.r + 8},${bgRgb.g + 8},${bgRgb.b + 8},1)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, groundY - 50, width, height - groundY + 50);

  // Grid lines
  ctx.strokeStyle = `rgba(${hexToRgb(theme.primary).r},${hexToRgb(theme.primary).g},${hexToRgb(theme.primary).b},0.12)`;
  ctx.lineWidth = 1;
  for (let i = -2; i < 25; i++) {
    const x = (i * 60 - scrollOffset);
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x - 200, height);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const y = groundY + i * 40;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Character (simple running figure — circle + body)
  const charX = width * 0.25;
  const charY = groundY - 50;
  const bounce = Math.sin(frame * 0.3) * 8;

  // Character shadow
  drawShadow(ctx, charX, groundY - 5, 35, 0.3);

  // Character body (pill shape)
  ctx.fillStyle = theme.primary;
  ctx.beginPath();
  ctx.arc(charX, charY - 30 + bounce, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(charX - 10, charY - 20 + bounce, 20, 35);
  ctx.beginPath();
  ctx.arc(charX, charY + 15 + bounce, 10, 0, Math.PI * 2);
  ctx.fill();

  // Character glow
  drawGlow(ctx, charX, charY + bounce, 40, theme.primary);

  // Legs animation
  const legAngle = Math.sin(frame * 0.4) * 0.4;
  ctx.strokeStyle = theme.primary;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(charX - 5, charY + 15 + bounce);
  ctx.lineTo(charX - 5 + Math.sin(legAngle) * 15, charY + 40 + bounce);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(charX + 5, charY + 15 + bounce);
  ctx.lineTo(charX + 5 - Math.sin(legAngle) * 15, charY + 40 + bounce);
  ctx.stroke();

  // Render obstacles and coins for current visible window
  const windowStart = frame - 5;
  const windowEnd = frame + fps * 2;
  const visibleEvents = events.filter(e => e.frame >= windowStart && e.frame <= windowEnd);

  for (const evt of visibleEvents) {
    const progress = (evt.frame - frame) / (fps * 1.5); // 0 = at character, 1 = far right
    const evtX = charX + progress * (width * 0.8);
    const evtY = groundY - 30 - (evt.y / 100) * 60;

    if (evtX < -50 || evtX > width + 50) continue;

    if (evt.type === 'obstacle') {
      drawIsometricCube(ctx, evtX, evtY, 25, theme.obstacle);
      drawShadow(ctx, evtX, groundY - 5, 25, 0.2);
    } else if (evt.type === 'coin') {
      const coinBob = Math.sin(frame * 0.15 + evt.frame) * 5;
      drawGlow(ctx, evtX, evtY + coinBob, 20, theme.coin);
      ctx.fillStyle = theme.coin;
      ctx.beginPath();
      ctx.arc(evtX, evtY + coinBob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.bg;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('$', evtX, evtY + coinBob + 4);

      // Collect animation
      if (Math.abs(evt.frame - frame) < 3 && progress < 0.1) {
        particles = particles.concat(spawnParticles(evtX, evtY, theme.coin, 8));
      }
    } else if (evt.type === 'near_miss' && Math.abs(evt.frame - frame) < 10) {
      // Screen flash
      const flashAlpha = Math.max(0, 1 - Math.abs(evt.frame - frame) / 10) * 0.15;
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
      ctx.fillRect(0, 0, width, height);
      ctx.font = 'bold 50px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.accent;
      ctx.fillText('CLOSE!', width / 2, height * 0.35);
    }
  }

  // Draw particles
  drawParticles(ctx, particles);
  particles = updateParticles(particles);

  return particles;
}

// ---------------------------------------------------------------------------
// Template: Ball Maze
// ---------------------------------------------------------------------------

function renderBallMaze(
  ctx: CanvasRenderingContext2D,
  frame: number,
  config: GameConfig,
  particles: Particle[],
): Particle[] {
  const { width, height, theme, events, fps, totalFrames } = config;
  const progress = frame / totalFrames; // 0 to 1

  // Background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);

  // Maze grid parameters
  const margin = 60;
  const mazeW = width - margin * 2;
  const mazeH = height - margin * 2 - 100; // leave space for title/score
  const cellSize = 80;
  const cols = Math.floor(mazeW / cellSize);
  const rows = Math.floor(mazeH / cellSize);
  const offsetX = margin + (mazeW - cols * cellSize) / 2;
  const offsetY = margin + 80 + (mazeH - rows * cellSize) / 2;

  // Draw maze border
  ctx.strokeStyle = theme.primary;
  ctx.lineWidth = 3;
  ctx.strokeRect(offsetX - 5, offsetY - 5, cols * cellSize + 10, rows * cellSize + 10);

  // Draw maze walls (pseudo-random based on position)
  ctx.lineWidth = 4;
  const wallColor = hexToRgb(theme.secondary);
  ctx.strokeStyle = `rgba(${wallColor.r},${wallColor.g},${wallColor.b},0.6)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = offsetX + c * cellSize;
      const wy = offsetY + r * cellSize;
      const seed = (r * 7 + c * 13 + 42) % 10;

      // Draw some walls based on seed (creates maze-like pattern)
      if (seed < 4 && c < cols - 1) {
        // Right wall with 3D effect
        ctx.fillStyle = `rgba(${wallColor.r},${wallColor.g},${wallColor.b},0.3)`;
        ctx.fillRect(wx + cellSize - 3, wy + 5, 6, cellSize - 10);
        ctx.strokeStyle = `rgba(${wallColor.r},${wallColor.g},${wallColor.b},0.6)`;
        ctx.beginPath();
        ctx.moveTo(wx + cellSize, wy + 5);
        ctx.lineTo(wx + cellSize, wy + cellSize - 5);
        ctx.stroke();
      }
      if (seed >= 4 && seed < 7 && r < rows - 1) {
        // Bottom wall with 3D effect
        ctx.fillStyle = `rgba(${wallColor.r},${wallColor.g},${wallColor.b},0.3)`;
        ctx.fillRect(wx + 5, wy + cellSize - 3, cellSize - 10, 6);
        ctx.strokeStyle = `rgba(${wallColor.r},${wallColor.g},${wallColor.b},0.6)`;
        ctx.beginPath();
        ctx.moveTo(wx + 5, wy + cellSize);
        ctx.lineTo(wx + cellSize - 5, wy + cellSize);
        ctx.stroke();
      }
    }
  }

  // Ball path (smooth movement through maze)
  // Ball follows a winding path based on progress
  const pathPoints = [
    { x: 0.1, y: 0.1 }, { x: 0.3, y: 0.1 }, { x: 0.3, y: 0.3 },
    { x: 0.6, y: 0.3 }, { x: 0.6, y: 0.15 }, { x: 0.85, y: 0.15 },
    { x: 0.85, y: 0.45 }, { x: 0.5, y: 0.45 }, { x: 0.5, y: 0.6 },
    { x: 0.2, y: 0.6 }, { x: 0.2, y: 0.8 }, { x: 0.5, y: 0.8 },
    { x: 0.7, y: 0.7 }, { x: 0.9, y: 0.9 },
  ];

  const totalSegments = pathPoints.length - 1;
  const segProgress = progress * totalSegments;
  const segIdx = Math.min(Math.floor(segProgress), totalSegments - 1);
  const segT = segProgress - segIdx;

  const p1 = pathPoints[segIdx];
  const p2 = pathPoints[Math.min(segIdx + 1, pathPoints.length - 1)];
  const ballRelX = p1.x + (p2.x - p1.x) * segT;
  const ballRelY = p1.y + (p2.y - p1.y) * segT;

  const ballX = offsetX + ballRelX * (cols * cellSize);
  const ballY = offsetY + ballRelY * (rows * cellSize);

  // Trail effect
  const trailLength = 12;
  for (let t = trailLength; t > 0; t--) {
    const trailProgress = Math.max(0, progress - (t * 0.003));
    const tSegProgress = trailProgress * totalSegments;
    const tSegIdx = Math.min(Math.floor(tSegProgress), totalSegments - 1);
    const tSegT = tSegProgress - tSegIdx;
    const tp1 = pathPoints[tSegIdx];
    const tp2 = pathPoints[Math.min(tSegIdx + 1, pathPoints.length - 1)];
    const tx = offsetX + (tp1.x + (tp2.x - tp1.x) * tSegT) * (cols * cellSize);
    const ty = offsetY + (tp1.y + (tp2.y - tp1.y) * tSegT) * (rows * cellSize);
    const alpha = (1 - t / trailLength) * 0.3;
    const rgb = hexToRgb(theme.primary);
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 12 - t * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ball shadow
  drawShadow(ctx, ballX + 4, ballY + 4, 18, 0.4);

  // Ball with gradient
  const ballGrad = ctx.createRadialGradient(ballX - 4, ballY - 4, 2, ballX, ballY, 16);
  ballGrad.addColorStop(0, '#FFFFFF');
  ballGrad.addColorStop(0.3, theme.primary);
  ballGrad.addColorStop(1, theme.secondary);
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(ballX, ballY, 16, 0, Math.PI * 2);
  ctx.fill();

  // Ball glow
  drawGlow(ctx, ballX, ballY, 30, theme.primary);

  // Exit marker (pulsing)
  const exitX = offsetX + 0.9 * (cols * cellSize);
  const exitY = offsetY + 0.9 * (rows * cellSize);
  const pulse = 0.8 + Math.sin(frame * 0.1) * 0.2;
  drawGlow(ctx, exitX, exitY, 35 * pulse, theme.accent);
  ctx.fillStyle = theme.accent;
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', exitX, exitY + 6);

  // Coins on path
  for (const evt of events) {
    if (evt.type !== 'coin') continue;
    if (evt.frame > frame + fps * 3 || evt.frame < frame - fps) continue;
    const collected = evt.frame < frame;
    if (collected) continue;

    const coinX = offsetX + (evt.x / 100) * (cols * cellSize);
    const coinY = offsetY + (evt.y / 100) * (rows * cellSize);
    const bob = Math.sin(frame * 0.1 + evt.frame) * 3;
    drawGlow(ctx, coinX, coinY + bob, 14, theme.coin);
    ctx.fillStyle = theme.coin;
    ctx.beginPath();
    ctx.arc(coinX, coinY + bob, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw particles
  drawParticles(ctx, particles);
  particles = updateParticles(particles);

  return particles;
}

// ---------------------------------------------------------------------------
// Template: Obstacle Tower
// ---------------------------------------------------------------------------

function renderObstacleTower(
  ctx: CanvasRenderingContext2D,
  frame: number,
  config: GameConfig,
  particles: Particle[],
): Particle[] {
  const { width, height, theme, events, fps, totalFrames } = config;
  const progress = frame / totalFrames;

  // Background gradient (gets darker toward top)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, lerpColor(theme.bg, '#000000', 0.3));
  bgGrad.addColorStop(1, theme.bg);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Camera scroll upward
  const maxScroll = height * 3;
  const scrollY = progress * maxScroll;

  // Draw side walls
  const wallWidth = 40;
  ctx.fillStyle = lerpColor(theme.bg, theme.secondary, 0.15);
  ctx.fillRect(0, 0, wallWidth, height);
  ctx.fillRect(width - wallWidth, 0, wallWidth, height);

  // Wall detail lines
  const lineColor = hexToRgb(theme.secondary);
  ctx.strokeStyle = `rgba(${lineColor.r},${lineColor.g},${lineColor.b},0.15)`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    const ly = ((i * 80 - scrollY * 0.5) % height + height) % height;
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(wallWidth, ly);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width - wallWidth, ly);
    ctx.lineTo(width, ly);
    ctx.stroke();
  }

  // Platforms
  const platformCount = Math.floor(config.duration * 1.5);
  const platformSpacing = maxScroll / platformCount;

  for (let i = 0; i < platformCount; i++) {
    const platY = height - (i * platformSpacing - scrollY);
    if (platY < -50 || platY > height + 50) continue;

    const platX = wallWidth + 20 + ((i * 137) % (width - wallWidth * 2 - 140));
    const platW = 120 + ((i * 43) % 80);

    // Platform shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(platX + 4, platY + 4, platW, 14);

    // Platform body
    const platColor = i % 3 === 0 ? theme.primary : i % 3 === 1 ? theme.secondary : theme.accent;
    ctx.fillStyle = platColor;
    ctx.fillRect(platX, platY, platW, 12);

    // Platform highlight
    ctx.fillStyle = `rgba(255,255,255,0.2)`;
    ctx.fillRect(platX, platY, platW, 4);
  }

  // Moving obstacles (horizontal bars)
  for (const evt of events) {
    if (evt.type !== 'obstacle') continue;
    const obstY = height - (evt.frame / fps * (maxScroll / config.duration) - scrollY);
    if (obstY < -50 || obstY > height + 50) continue;

    const obstWidth = evt.variant === 'wall' ? width * 0.6 : width * 0.35;
    const oscillation = Math.sin(frame * 0.03 + evt.frame * 0.1) * (width * 0.15);
    const obstX = (evt.x / 100) * (width - obstWidth) + oscillation;

    // Obstacle
    ctx.fillStyle = theme.obstacle;
    ctx.fillRect(Math.max(wallWidth, obstX), obstY, obstWidth, 10);

    // Glow
    const obstRgb = hexToRgb(theme.obstacle);
    ctx.shadowColor = `rgba(${obstRgb.r},${obstRgb.g},${obstRgb.b},0.5)`;
    ctx.shadowBlur = 10;
    ctx.fillRect(Math.max(wallWidth, obstX), obstY, obstWidth, 10);
    ctx.shadowBlur = 0;
  }

  // Character/Ball
  const charX = width / 2 + Math.sin(frame * 0.05) * (width * 0.15);
  const charBaseY = height * 0.7;
  const jumpPhase = Math.abs(Math.sin(frame * 0.08));
  const charY = charBaseY - jumpPhase * 60;

  // Character shadow
  drawShadow(ctx, charX, charBaseY + 10, 25, 0.3 * (1 - jumpPhase * 0.5));

  // Character ball
  const charGrad = ctx.createRadialGradient(charX - 3, charY - 3, 2, charX, charY, 18);
  charGrad.addColorStop(0, '#FFFFFF');
  charGrad.addColorStop(0.4, theme.primary);
  charGrad.addColorStop(1, theme.secondary);
  ctx.fillStyle = charGrad;
  ctx.beginPath();
  ctx.arc(charX, charY, 18, 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, charX, charY, 30, theme.primary);

  // Height counter
  const currentHeight = Math.floor(progress * 100);
  ctx.save();
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillText(`${currentHeight}m`, 62, 92);
  ctx.fillStyle = theme.accent;
  ctx.fillText(`${currentHeight}m`, 60, 90);
  ctx.restore();

  // Coins
  for (const evt of events) {
    if (evt.type !== 'coin') continue;
    const coinY = height - (evt.frame / fps * (maxScroll / config.duration) - scrollY);
    if (coinY < -30 || coinY > height + 30) continue;
    const coinX = wallWidth + (evt.x / 100) * (width - wallWidth * 2);
    const bob = Math.sin(frame * 0.12 + evt.frame) * 4;
    drawGlow(ctx, coinX, coinY + bob, 15, theme.coin);
    ctx.fillStyle = theme.coin;
    ctx.beginPath();
    ctx.arc(coinX, coinY + bob, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw particles
  drawParticles(ctx, particles);
  particles = updateParticles(particles);

  return particles;
}

// ---------------------------------------------------------------------------
// Template: Color Switch
// ---------------------------------------------------------------------------

const COLOR_SWITCH_COLORS: Record<string, string> = {
  red: '#FF4444',
  blue: '#4488FF',
  green: '#44FF44',
  yellow: '#FFDD44',
};

function renderColorSwitch(
  ctx: CanvasRenderingContext2D,
  frame: number,
  config: GameConfig,
  particles: Particle[],
): Particle[] {
  const { width, height, theme, events, fps, totalFrames } = config;
  const progress = frame / totalFrames;

  // Background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle background pattern (vertical lines)
  const patternRgb = hexToRgb(theme.primary);
  ctx.strokeStyle = `rgba(${patternRgb.r},${patternRgb.g},${patternRgb.b},0.04)`;
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }

  // Determine current ball color from color_change events
  let currentColor = 'red';
  for (const evt of events) {
    if (evt.type === 'color_change' && evt.frame <= frame && evt.variant) {
      currentColor = evt.variant;
    }
  }
  const ballHex = COLOR_SWITCH_COLORS[currentColor] || theme.primary;

  // Camera scroll upward
  const scrollSpeed = height * 2;
  const scrollY = progress * scrollSpeed;

  // Center lane
  const centerX = width / 2;

  // Color gates (rings)
  const gateSpacing = 250;
  const numGates = Math.ceil(scrollSpeed / gateSpacing) + 3;

  for (let i = 0; i < numGates; i++) {
    const gateY = height - (i * gateSpacing - scrollY);
    if (gateY < -100 || gateY > height + 100) continue;

    const gateColors = ['red', 'blue', 'green', 'yellow'];
    const rotation = frame * 0.02 + i * 0.5;
    const ringRadius = 60;
    const segmentAngle = (Math.PI * 2) / 4;

    // Draw rotating ring segments
    for (let s = 0; s < 4; s++) {
      const startAngle = rotation + s * segmentAngle;
      const endAngle = startAngle + segmentAngle - 0.05;
      const gateColor = COLOR_SWITCH_COLORS[gateColors[s]];

      ctx.strokeStyle = gateColor;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(centerX, gateY, ringRadius, startAngle, endAngle);
      ctx.stroke();

      // Glow on matching color
      if (gateColors[s] === currentColor) {
        ctx.strokeStyle = gateColor;
        ctx.lineWidth = 20;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(centerX, gateY, ringRadius, startAngle, endAngle);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Pass-through effect
    const ballScreenY = height * 0.65;
    if (Math.abs(gateY - ballScreenY) < 15) {
      // Particle burst
      if (Math.abs(gateY - ballScreenY) < 5) {
        particles = particles.concat(spawnParticles(centerX, ballScreenY, ballHex, 12));
      }
    }
  }

  // Ball
  const ballY = height * 0.65;
  const wobble = Math.sin(frame * 0.15) * 3;

  // Ball trail (neon glow)
  for (let t = 8; t > 0; t--) {
    const trailY = ballY + t * 8;
    const alpha = (1 - t / 8) * 0.2;
    const rgb = hexToRgb(ballHex);
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    ctx.beginPath();
    ctx.arc(centerX, trailY, 16 - t, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ball shadow/glow
  drawGlow(ctx, centerX, ballY + wobble, 45, ballHex);

  // Ball body
  const ballGrad = ctx.createRadialGradient(centerX - 4, ballY + wobble - 4, 2, centerX, ballY + wobble, 20);
  ballGrad.addColorStop(0, '#FFFFFF');
  ballGrad.addColorStop(0.4, ballHex);
  ballGrad.addColorStop(1, lerpColor(ballHex, '#000000', 0.3));
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(centerX, ballY + wobble, 20, 0, Math.PI * 2);
  ctx.fill();

  // Ball highlight
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(centerX - 5, ballY + wobble - 5, 6, 0, Math.PI * 2);
  ctx.fill();

  // Color change flash
  for (const evt of events) {
    if (evt.type === 'color_change' && Math.abs(evt.frame - frame) < 8) {
      const flashAlpha = Math.max(0, 1 - Math.abs(evt.frame - frame) / 8) * 0.1;
      const flashColor = COLOR_SWITCH_COLORS[evt.variant || 'red'];
      const flashRgb = hexToRgb(flashColor);
      ctx.fillStyle = `rgba(${flashRgb.r},${flashRgb.g},${flashRgb.b},${flashAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Draw particles
  drawParticles(ctx, particles);
  particles = updateParticles(particles);

  return particles;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export async function renderGameplayFrames(
  config: GameConfig,
  tmpDir: string,
  onProgress?: (rendered: number, total: number) => void,
): Promise<number> {
  const { width, height, totalFrames, template, theme } = config;

  log.info({ template, width, height, totalFrames, tmpDir }, 'Starting frame rendering');

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  let particles: Particle[] = [];

  for (let frame = 0; frame < totalFrames; frame++) {
    // Clear
    ctx.clearRect(0, 0, width, height);

    // Render template
    switch (template) {
      case 'ENDLESS_RUNNER':
        particles = renderEndlessRunner(ctx, frame, config, particles);
        break;
      case 'BALL_MAZE':
        particles = renderBallMaze(ctx, frame, config, particles);
        break;
      case 'OBSTACLE_TOWER':
        particles = renderObstacleTower(ctx, frame, config, particles);
        break;
      case 'COLOR_SWITCH':
        particles = renderColorSwitch(ctx, frame, config, particles);
        break;
      default:
        particles = renderEndlessRunner(ctx, frame, config, particles);
    }

    // Overlay: Game title
    if (config.gameTitle) {
      drawGameTitle(ctx, config.gameTitle, width, theme);
    }

    // Overlay: Score
    if (config.showScore) {
      const sec = Math.min(Math.floor(frame / config.fps), config.scoreProgression.length - 1);
      const score = config.scoreProgression[Math.max(0, sec)] || 0;
      drawScore(ctx, score, width - 30, 55, theme);
    }

    // Overlay: CTA (show in last 3 seconds)
    if (config.ctaText && frame >= totalFrames - config.fps * 3) {
      drawCTA(ctx, config.ctaText, width, height, theme);
    }

    // Save frame as PNG
    const frameNum = String(frame).padStart(5, '0');
    const framePath = path.join(tmpDir, `frame_${frameNum}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(framePath, buffer);

    // Report progress
    if (onProgress && frame % 10 === 0) {
      onProgress(frame, totalFrames);
    }
  }

  log.info({ totalFrames, template }, 'Frame rendering complete');
  return totalFrames;
}
