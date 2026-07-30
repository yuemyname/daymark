// E2 dither — 디더링 (SPEC §7).
// Bayer 2/4/8 순서 행렬 + Floyd–Steinberg 오차 확산.
//
// ★ §9의 유일한 예외: pixelSize는 유닛이 아니라 "출력 픽셀" 기준이다.
//   유닛으로 하면 4096 내보내기에서 디더 셀이 커져 패턴이 뭉개진다.
//   1024px 기준값을 size에 비례시킨다: px = pixelSize × (size / 1024).
//   이 규칙을 지우면 W5.2 검수에서 값을 치른다.

import type { EffectArgs } from './index';

const BAYER2 = [0, 2, 3, 1];
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function bayer8(): number[] {
  // 4×4를 재귀 확장
  const m = new Array<number>(64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const q = BAYER4[(y % 4) * 4 + (x % 4)] ?? 0;
      m[y * 8 + x] = q * 4 + (BAYER2[Math.floor(y / 4) * 2 + Math.floor(x / 4)] ?? 0);
    }
  }
  return m;
}
const BAYER8 = bayer8();

export function dither(a: EffectArgs): void {
  const { ctx, size, lum, ink, params } = a;
  const cfg = params.effectConfig;
  if (cfg.kind !== 'dither') throw new Error(`wrong config: ${cfg.kind}`);

  const px = Math.max(2, Math.round(cfg.pixelSize * (size / 1024))); // §9 예외
  const cols = Math.ceil(size / px);
  const rows = cols;

  ctx.fillStyle = ink;

  if (cfg.pattern === 'fs') {
    // Floyd–Steinberg — 셀 그리드 위 오차 확산 (순회 순서 = 결정 순서)
    const g = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        g[y * cols + x] = lum((x + 0.5) / cols, (y + 0.5) / rows) + cfg.threshold;
      }
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const old = g[i] ?? 0;
        const on = old >= 0.5;
        const err = old - (on ? 1 : 0);
        if (on) ctx.fillRect(x * px, y * px, px, px);
        if (x + 1 < cols) g[i + 1] = (g[i + 1] ?? 0) + err * (7 / 16);
        if (y + 1 < rows) {
          if (x > 0) g[i + cols - 1] = (g[i + cols - 1] ?? 0) + err * (3 / 16);
          g[i + cols] = (g[i + cols] ?? 0) + err * (5 / 16);
          if (x + 1 < cols) g[i + cols + 1] = (g[i + cols + 1] ?? 0) + err * (1 / 16);
        }
      }
    }
    return;
  }

  const matrix = cfg.pattern === 'bayer2' ? BAYER2 : cfg.pattern === 'bayer4' ? BAYER4 : BAYER8;
  const n = cfg.pattern === 'bayer2' ? 2 : cfg.pattern === 'bayer4' ? 4 : 8;
  const denom = n * n;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = lum((x + 0.5) / cols, (y + 0.5) / rows) + cfg.threshold;
      const t = ((matrix[(y % n) * n + (x % n)] ?? 0) + 0.5) / denom;
      if (d >= t) ctx.fillRect(x * px, y * px, px, px);
    }
  }
}
