// S4 subdivision — 재귀 분할 (SPEC §6).
// 사각형을 비율 r로 쪼개며 내려가고, 리프를 leafMix 분포에 따라 채운다.
// splitBias가 0.5 근처면 몬드리안, 치우치면 로그 스케일 느낌.
//
// 모든 좌표는 유닛 [0,1]². 시작에 enterUnitSpace로 스케일을 걸고
// lineWidth까지 유닛 값 그대로 쓴다 (core/canvas.ts의 확정 규칙).

import { enterUnitSpace, exitUnitSpace } from '../core/canvas';
import type { LeafMix, SubdivisionConfig } from '../params/types';
import type { RenderArgs } from './index';

type Rect = { x: number; y: number; w: number; h: number };
type LeafKind = keyof LeafMix;

function pickLeafKind(mix: LeafMix, rng: () => number): LeafKind {
  const t = rng() * (mix.solid + mix.hatch + mix.empty + mix.concentric);
  if (t < mix.solid) return 'solid';
  if (t < mix.solid + mix.hatch) return 'hatch';
  if (t < mix.solid + mix.hatch + mix.empty) return 'empty';
  return 'concentric';
}

function pickInk(inks: string[], rng: () => number): string {
  const ink = inks[Math.floor(rng() * inks.length)];
  if (ink === undefined) throw new Error('empty palette');
  return ink;
}

export function* subdivision(a: RenderArgs): Generator<void, void, void> {
  const { ctx, size, params, rng } = a;
  const cfg = params.config;
  if (cfg.kind !== 'subdivision') throw new Error(`wrong config: ${cfg.kind}`);
  const inks = params.palette.inks;

  enterUnitSpace(ctx, size);

  ctx.fillStyle = params.palette.bg;
  ctx.fillRect(0, 0, 1, 1);
  yield;

  // 리프 목록을 먼저 확정한다 (rng 소비 순서 = 분할 순서로 고정).
  // 그리기는 그 다음 — 리프 하나가 점진 렌더의 한 스텝이다.
  const leaves: Rect[] = [];
  collect({ x: 0, y: 0, w: 1, h: 1 }, 0, cfg, rng, leaves);

  for (const leaf of leaves) {
    drawLeaf(ctx, leaf, cfg, inks, rng);
    yield;
  }

  exitUnitSpace(ctx);
}

function collect(
  r: Rect,
  depth: number,
  cfg: SubdivisionConfig,
  rng: () => number,
  out: Rect[],
): void {
  const longSide = Math.max(r.w, r.h);
  const canSplit = depth < cfg.maxDepth && longSide > cfg.minSize * 2;
  // 얕을 때는 반드시 쪼개고, 깊어질수록 리프로 남을 확률을 키운다
  const splitP = depth < 2 ? 1 : 1 - depth / (cfg.maxDepth + 1);
  if (!canSplit || rng() >= splitP) {
    out.push(r);
    return;
  }

  // 분할 비율 — splitBias 중심으로 지터. 극단으로 붙지 않게 클램프
  const t = Math.min(0.85, Math.max(0.15, cfg.splitBias + (rng() - 0.5) * 0.3));
  if (r.w >= r.h) {
    const w1 = r.w * t;
    collect({ x: r.x, y: r.y, w: w1, h: r.h }, depth + 1, cfg, rng, out);
    collect({ x: r.x + w1, y: r.y, w: r.w - w1, h: r.h }, depth + 1, cfg, rng, out);
  } else {
    const h1 = r.h * t;
    collect({ x: r.x, y: r.y, w: r.w, h: h1 }, depth + 1, cfg, rng, out);
    collect({ x: r.x, y: r.y + h1, w: r.w, h: r.h - h1 }, depth + 1, cfg, rng, out);
  }
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  leaf: Rect,
  cfg: SubdivisionConfig,
  inks: string[],
  rng: () => number,
): void {
  const g = cfg.gutter / 2;
  const x = leaf.x + g;
  const y = leaf.y + g;
  const w = leaf.w - cfg.gutter;
  const h = leaf.h - cfg.gutter;
  if (w <= 0 || h <= 0) return;

  const kind = pickLeafKind(cfg.leafMix, rng);
  const ink = pickInk(inks, rng);

  switch (kind) {
    case 'empty':
      return;
    case 'solid':
      ctx.fillStyle = ink;
      ctx.fillRect(x, y, w, h);
      return;
    case 'hatch': {
      // 해칭 — 칸을 클립하고 선 다발. 방향을 칸마다 바꿔야
      // 인접한 해칭 칸이 한 덩어리로 뭉쳐 보이지 않는다.
      const spacing = 0.008 + rng() * 0.01;
      const dir = Math.floor(rng() * 4); // 0:'\' 1:'/' 2:'|' 3:'—'
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 0.0022;
      ctx.beginPath();
      if (dir === 0) {
        for (let s = -h; s <= w; s += spacing) {
          ctx.moveTo(x + s, y);
          ctx.lineTo(x + s + h, y + h);
        }
      } else if (dir === 1) {
        for (let s = -h; s <= w; s += spacing) {
          ctx.moveTo(x + s, y + h);
          ctx.lineTo(x + s + h, y);
        }
      } else if (dir === 2) {
        for (let s = 0; s <= w; s += spacing) {
          ctx.moveTo(x + s, y);
          ctx.lineTo(x + s, y + h);
        }
      } else {
        for (let s = 0; s <= h; s += spacing) {
          ctx.moveTo(x, y + s);
          ctx.lineTo(x + w, y + s);
        }
      }
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'concentric': {
      // 안쪽으로 수축하는 사각 띠
      ctx.strokeStyle = ink;
      ctx.lineWidth = 0.0022;
      const step = 0.012 + rng() * 0.014;
      let inset = step / 2;
      while (w - inset * 2 > step && h - inset * 2 > step) {
        ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
        inset += step;
      }
      return;
    }
  }
}
