// F1 noise — 심플렉스 노이즈 (SPEC §6).
// 도메인 워핑을 주면 대리석/등고선 느낌. phase는 3번째 축 —
// 분이 바뀌면 어차피 재추첨되므로 z축 이동만으로 초 사이가 매끄럽다.

import { createNoise3D } from 'simplex-noise';
import type { FieldArgs } from './index';

export function noise(a: FieldArgs): void {
  const { buf, res, params, rng } = a;
  const cfg = params.fieldConfig;
  if (cfg.kind !== 'noise') throw new Error(`wrong config: ${cfg.kind}`);

  const n3 = createNoise3D(rng);
  const z = params.phase * 1.2;

  for (let py = 0; py < res; py++) {
    const y = py / (res - 1);
    for (let px = 0; px < res; px++) {
      const x = px / (res - 1);

      let wx = x;
      let wy = y;
      if (cfg.warp > 0) {
        wx += cfg.warp * n3(x * cfg.scale + 13.7, y * cfg.scale, z);
        wy += cfg.warp * n3(x * cfg.scale, y * cfg.scale + 41.3, z);
      }

      let v = 0;
      let ampSum = 0;
      let freq = cfg.scale;
      let amp = 1;
      for (let o = 0; o < cfg.octaves; o++) {
        v += amp * n3(wx * freq, wy * freq, z);
        ampSum += amp;
        freq *= 2;
        amp *= 0.5;
      }
      v /= ampSum;

      if (cfg.ridged) v = 1 - Math.abs(v) * 2;
      buf[py * res + px] = Math.min(1, Math.max(0, v * 0.5 + 0.5));
    }
  }
}
