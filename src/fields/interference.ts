// F3 interference — 간섭 줄무늬 (SPEC §6).
// 서로 다른 각도·주기의 사인 다발을 겹쳐 모아레.
// phase는 레이어마다 0.5×~1.5× 배속으로 — 무늬가 천천히 미끄러진다.

import type { FieldArgs } from './index';

const TAU = Math.PI * 2;

export function interference(a: FieldArgs): void {
  const { buf, res, params } = a;
  const cfg = params.fieldConfig;
  if (cfg.kind !== 'interference') throw new Error(`wrong config: ${cfg.kind}`);

  for (let py = 0; py < res; py++) {
    const y = py / (res - 1);
    for (let px = 0; px < res; px++) {
      const x = px / (res - 1);
      let v = 0;
      let ampSum = 0;
      for (const layer of cfg.layers) {
        const t = x * Math.cos(layer.angle) + y * Math.sin(layer.angle);
        v +=
          layer.amp *
          Math.sin(t * layer.freq * TAU + layer.phaseOffset + params.phase * TAU * layer.speed);
        ampSum += layer.amp;
      }
      buf[py * res + px] = Math.min(1, Math.max(0, 0.5 + (v / ampSum) * 0.5));
    }
  }
}
