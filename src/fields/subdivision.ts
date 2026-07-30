// F4 subdivision — 재귀 분할 (SPEC §6).
// 사각형을 쪼개며 내려가 리프에 회색값을 채운다.
// phase를 안 쓰는 유일한 필드 — 1분간 완전히 정지한다.
// 전부 움직이면 정신없어서 정지 카드가 하나는 필요하다.

import type { FieldArgs } from './index';
import type { SubdivisionConfig } from '../params/types';

type Rect = { x: number; y: number; w: number; h: number };

export function subdivision(a: FieldArgs): void {
  const { buf, res, params, rng } = a;
  const cfg = params.fieldConfig;
  if (cfg.kind !== 'subdivision') throw new Error(`wrong config: ${cfg.kind}`);

  buf.fill(0);

  const leaves: { rect: Rect; gray: number }[] = [];
  collect({ x: 0, y: 0, w: 1, h: 1 }, 0, cfg, rng, leaves);

  for (const { rect, gray } of leaves) {
    const g = cfg.gutter / 2;
    fillRect(buf, res, rect.x + g, rect.y + g, rect.w - cfg.gutter, rect.h - cfg.gutter, gray);
  }
}

function collect(
  r: Rect,
  depth: number,
  cfg: SubdivisionConfig,
  rng: () => number,
  out: { rect: Rect; gray: number }[],
): void {
  const longSide = Math.max(r.w, r.h);
  const canSplit = depth < cfg.maxDepth && longSide > cfg.minSize * 2;
  const splitP = depth < 2 ? 1 : 1 - depth / (cfg.maxDepth + 1);
  if (!canSplit || rng() >= splitP) {
    // 리프 회색값 — 계조가 살도록 극단(0/1)을 포함해 뽑는다
    const roll = rng();
    const gray = roll < 0.15 ? 0 : roll < 0.3 ? 1 : rng();
    out.push({ rect: r, gray });
    return;
  }
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

function fillRect(
  buf: Float32Array,
  res: number,
  x: number,
  y: number,
  w: number,
  h: number,
  v: number,
): void {
  if (w <= 0 || h <= 0) return;
  const x0 = Math.max(0, Math.round(x * res));
  const y0 = Math.max(0, Math.round(y * res));
  const x1 = Math.min(res, Math.round((x + w) * res));
  const y1 = Math.min(res, Math.round((y + h) * res));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      buf[py * res + px] = v;
    }
  }
}
