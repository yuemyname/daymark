// E3 stipple — 스티플링 (SPEC §7).
// 회전된 사각 격자의 각 칸에 짧은 획을 긋고, 굵기가 밀도를 따라간다.

import { enterUnitSpace, exitUnitSpace } from '../core/canvas';
import type { EffectArgs } from './index';

export function stipple(a: EffectArgs): void {
  const { ctx, size, lum, ink, params } = a;
  const cfg = params.effectConfig;
  if (cfg.kind !== 'stipple') throw new Error(`wrong config: ${cfg.kind}`);

  enterUnitSpace(ctx, size);
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';

  const cw = 1 / cfg.xSquares;
  const ch = 1 / cfg.ySquares;
  const cos = Math.cos(cfg.angle);
  const sin = Math.sin(cfg.angle);
  const half = Math.min(cw, ch) * 0.42;
  const ext = Math.ceil(Math.max(cfg.xSquares, cfg.ySquares) * 0.75);

  for (let j = -ext; j < cfg.ySquares + ext; j++) {
    for (let i = -ext; i < cfg.xSquares + ext; i++) {
      const bx = (i + 0.5) * cw;
      const by = (j + 0.5) * ch;
      const x = 0.5 + (bx - 0.5) * cos - (by - 0.5) * sin;
      const y = 0.5 + (bx - 0.5) * sin + (by - 0.5) * cos;
      if (x < -cw || x > 1 + cw || y < -ch || y > 1 + ch) continue;

      const d = lum(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
      const w = Math.min(cw, ch) * (cfg.minW + d * (cfg.maxW - cfg.minW));
      if (w < Math.min(cw, ch) * 0.03) continue;

      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x - half * cos, y - half * sin);
      ctx.lineTo(x + half * cos, y + half * sin);
      ctx.stroke();
    }
  }

  exitUnitSpace(ctx);
}
