// E4 steps — 계단 톤 (SPEC §7, tooooools gradients 대응).
// 밀도를 levels 단계로 양자화해 셀마다 rect/ellipse 마크 크기로 옮긴다.

import { enterUnitSpace, exitUnitSpace } from '../core/canvas';
import type { EffectArgs } from './index';

export function steps(a: EffectArgs): void {
  const { ctx, size, lum, ink, params } = a;
  const cfg = params.effectConfig;
  if (cfg.kind !== 'steps') throw new Error(`wrong config: ${cfg.kind}`);

  enterUnitSpace(ctx, size);
  ctx.fillStyle = ink;

  const cell = cfg.stepSize;
  const n = Math.ceil(1 / cell);

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * cell;
      const y = (j + 0.5) * cell;
      const d = lum(Math.min(1, x), Math.min(1, y));
      // 양자화 — 계단이 눈에 보여야 steps다
      const q = Math.round(d * cfg.levels) / cfg.levels;
      if (q <= 0) continue;
      const half = cell * 0.5 * Math.sqrt(q); // 면적이 밀도에 비례
      if (cfg.shape === 'rect') {
        ctx.fillRect(x - half, y - half, half * 2, half * 2);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, half, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  exitUnitSpace(ctx);
}
