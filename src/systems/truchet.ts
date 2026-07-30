// S3 truchet — 트루셰 타일 (SPEC §6).
// 격자의 각 칸에 방향이 다른 타일을 놓아 연속된 무늬를 만든다.
// subdivide 확률로 칸을 4분할해 재귀 — 다중 스케일이 되면 훨씬 좋아진다.
// 선 굵기는 칸 크기에 비례한다 (분할된 칸에서도 자연스럽게).

import { enterUnitSpace, exitUnitSpace } from '../core/canvas';
import type { TruchetConfig, TruchetVariant } from '../params/types';
import type { RenderArgs } from './index';

const MAX_SUBDIVIDE_DEPTH = 2;

export function* truchet(a: RenderArgs): Generator<void, void, void> {
  const { ctx, size, params, rng } = a;
  const cfg = params.config;
  if (cfg.kind !== 'truchet') throw new Error(`wrong config: ${cfg.kind}`);
  const inks = params.palette.inks;

  enterUnitSpace(ctx, size);
  ctx.fillStyle = params.palette.bg;
  ctx.fillRect(0, 0, 1, 1);
  ctx.lineCap = 'round';
  yield;

  const cell = 1 / cfg.grid;
  for (let row = 0; row < cfg.grid; row++) {
    for (let col = 0; col < cfg.grid; col++) {
      tile(ctx, col * cell, row * cell, cell, 0, cfg, inks, rng);
    }
    yield; // 행 단위가 점진 렌더의 한 스텝
  }

  exitUnitSpace(ctx);
}

function tile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  depth: number,
  cfg: TruchetConfig,
  inks: string[],
  rng: () => number,
): void {
  if (depth < MAX_SUBDIVIDE_DEPTH && rng() < cfg.subdivide) {
    const h = s / 2;
    tile(ctx, x, y, h, depth + 1, cfg, inks, rng);
    tile(ctx, x + h, y, h, depth + 1, cfg, inks, rng);
    tile(ctx, x, y + h, h, depth + 1, cfg, inks, rng);
    tile(ctx, x + h, y + h, h, depth + 1, cfg, inks, rng);
    return;
  }

  const flip = rng() < 0.5;
  // 무늬가 칸을 넘어 이어져 보이려면 잉크가 대체로 한 색이어야 한다.
  // 20%만 다른 잉크를 섞어 악센트로 쓴다.
  const inkRoll = rng();
  const ink =
    inkRoll < 0.8 ? inks[0] : inks[1 + Math.floor((inkRoll - 0.8) * 5 * (inks.length - 1))];
  if (ink === undefined) throw new Error('empty palette');
  ctx.strokeStyle = ink;
  ctx.lineWidth = cfg.weight * s * (cfg.variant === 'arcThick' ? 1.8 : 1);

  drawTile(ctx, cfg.variant, x, y, s, flip);
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  variant: TruchetVariant,
  x: number,
  y: number,
  s: number,
  flip: boolean,
): void {
  const h = s / 2;
  ctx.beginPath();
  switch (variant) {
    case 'arc':
    case 'arcThick':
      // 마주 보는 두 모서리에서 변 중점을 잇는 사분원 호 두 개
      if (flip) {
        ctx.arc(x, y, h, 0, Math.PI / 2);
        ctx.moveTo(x + s, y + h);
        ctx.arc(x + s, y + s, h, Math.PI, Math.PI * 1.5);
      } else {
        ctx.arc(x + s, y, h, Math.PI / 2, Math.PI);
        ctx.moveTo(x, y + h);
        ctx.arc(x, y + s, h, Math.PI * 1.5, Math.PI * 2);
      }
      break;
    case 'diagonal':
      // 꼭짓점을 잇는 대각선 (10 PRINT)
      if (flip) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + s, y + s);
      } else {
        ctx.moveTo(x + s, y);
        ctx.lineTo(x, y + s);
      }
      break;
    case 'maze':
      // 변 중점을 직선 현(chord)으로 잇는다 — 호(arc)의 각진 버전.
      // (중심에서 만나는 엘보로 그리면 십자 격자처럼 보여서 W4.3에서 교체)
      if (flip) {
        ctx.moveTo(x + h, y); // 상 ↔ 우
        ctx.lineTo(x + s, y + h);
        ctx.moveTo(x, y + h); // 좌 ↔ 하
        ctx.lineTo(x + h, y + s);
      } else {
        ctx.moveTo(x + h, y); // 상 ↔ 좌
        ctx.lineTo(x, y + h);
        ctx.moveTo(x + s, y + h); // 우 ↔ 하
        ctx.lineTo(x + h, y + s);
      }
      break;
  }
  ctx.stroke();
}
