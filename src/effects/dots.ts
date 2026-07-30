// E1 dots — 하프톤 (SPEC §7).
// 회전된 격자 위에서 점 크기가 밀도를 따라간다. benday는 홀수 행을 반 칸 민다.
// 유닛 좌표 (§9) — 그릴 때만 × size.

import { enterUnitSpace, exitUnitSpace } from '../core/canvas';
import type { EffectArgs } from './index';

export function dots(a: EffectArgs): void {
  const { ctx, size, lum, ink, params } = a;
  const cfg = params.effectConfig;
  if (cfg.kind !== 'dots') throw new Error(`wrong config: ${cfg.kind}`);

  enterUnitSpace(ctx, size);
  ctx.fillStyle = ink;

  const cell = 1 / cfg.grid;
  const cos = Math.cos(cfg.angle);
  const sin = Math.sin(cfg.angle);
  // 회전해도 캔버스를 덮도록 격자 인덱스를 넉넉히 돈다
  const ext = Math.ceil(cfg.grid * 0.75);

  for (let j = -ext; j < cfg.grid + ext; j++) {
    for (let i = -ext; i < cfg.grid + ext; i++) {
      const bx = (i + 0.5 + (cfg.gridType === 'benday' && ((j % 2) + 2) % 2 === 1 ? 0.5 : 0)) * cell;
      const by = (j + 0.5) * cell;
      // 중심 기준 회전
      const x = 0.5 + (bx - 0.5) * cos - (by - 0.5) * sin;
      const y = 0.5 + (bx - 0.5) * sin + (by - 0.5) * cos;
      if (x < -cell || x > 1 + cell || y < -cell || y > 1 + cell) continue;

      const d = lum(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
      const r = cell * (cfg.minR + d * (cfg.maxR - cfg.minR));
      if (r < cell * 0.03) continue;

      if (cfg.cornerRadius >= 1) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 모서리 둥근 사각 마크
        const cr = r * cfg.cornerRadius;
        ctx.beginPath();
        ctx.roundRect(x - r, y - r, r * 2, r * 2, cr);
        ctx.fill();
      }
    }
  }

  exitUnitSpace(ctx);
}
