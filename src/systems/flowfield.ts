// S1 flowfield — 흐름장 (SPEC §6).
// 심플렉스 노이즈 각도장을 따라 입자를 흘려 궤적을 남긴다.
// 입자 시작점은 지터를 준 격자 (완전 랜덤보다 밀도가 고르다).
// 궤적은 진행할수록 얇아진다(taper) — 붓질 느낌.

import { createNoise2D } from 'simplex-noise';
import { enterUnitSpace, exitUnitSpace } from '../core/canvas';
import type { RenderArgs } from './index';

// 궤적을 몇 구간으로 나눠 각 구간 굵기를 줄일지 (구간별 stroke 1회)
const TAPER_SEGMENTS = 3;
const PARTICLES_PER_STEP = 24;
const BASE_WIDTH = 0.0035;

export function* flowfield(a: RenderArgs): Generator<void, void, void> {
  const { ctx, size, params, rng } = a;
  const cfg = params.config;
  if (cfg.kind !== 'flowfield') throw new Error(`wrong config: ${cfg.kind}`);
  const inks = params.palette.inks;

  enterUnitSpace(ctx, size);
  ctx.fillStyle = params.palette.bg;
  ctx.fillRect(0, 0, 1, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  yield;

  const noise2D = createNoise2D(rng);
  const angleAt = (x: number, y: number): number =>
    noise2D(x * cfg.noiseScale, y * cfg.noiseScale) * Math.PI * cfg.turns;

  // 지터 격자 시작점
  const grid = Math.ceil(Math.sqrt(cfg.particles));
  const starts: { x: number; y: number; ink: string }[] = [];
  for (let i = 0; i < cfg.particles; i++) {
    const gx = i % grid;
    const gy = Math.floor(i / grid);
    const ink = inks[Math.floor(rng() * inks.length)];
    if (ink === undefined) throw new Error('empty palette');
    starts.push({
      x: (gx + 0.2 + rng() * 0.6) / grid,
      y: (gy + 0.2 + rng() * 0.6) / grid,
      ink,
    });
  }

  ctx.globalAlpha = Math.min(1, cfg.alpha * 8); // config alpha(0.03~0.12)를 보이는 범위로
  for (let p = 0; p < starts.length; p++) {
    const s = starts[p];
    if (!s) continue;
    drawTrajectory(ctx, s.x, s.y, s.ink, cfg.steps, cfg.stepLen, cfg.taper, angleAt);
    if (p % PARTICLES_PER_STEP === PARTICLES_PER_STEP - 1) yield;
  }
  ctx.globalAlpha = 1;

  exitUnitSpace(ctx);
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ink: string,
  steps: number,
  stepLen: number,
  taper: number,
  angleAt: (x: number, y: number) => number,
): void {
  ctx.strokeStyle = ink;
  const perSegment = Math.max(2, Math.ceil(steps / TAPER_SEGMENTS));
  let px = x;
  let py = y;
  let step = 0;
  for (let seg = 0; seg < TAPER_SEGMENTS && step < steps; seg++) {
    // 구간이 진행될수록 얇게
    const t = seg / TAPER_SEGMENTS;
    ctx.lineWidth = BASE_WIDTH * (1 - t * taper);
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let i = 0; i < perSegment && step < steps; i++, step++) {
      const ang = angleAt(px, py);
      px += Math.cos(ang) * stepLen;
      py += Math.sin(ang) * stepLen;
      if (px < -0.05 || px > 1.05 || py < -0.05 || py > 1.05) {
        step = steps; // 화면 밖 — 종료
        break;
      }
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}
