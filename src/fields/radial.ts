// F2 radial — 시계 기하 ★ (SPEC §6).
// 중심에서 뻗는 방사·동심원. handInfluence가 이 프로젝트의 시그니처다:
// 초침/분침/시침 각도를 각각 가우시안 로브로 밀도에 더한다 —
// 그림이 곧 시각의 도해가 된다.

import { hmsOf } from '../core/time';
import type { FieldArgs } from './index';

const TAU = Math.PI * 2;

export function radial(a: FieldArgs): void {
  const { buf, res, params } = a;
  const cfg = params.fieldConfig;
  if (cfg.kind !== 'radial') throw new Error(`wrong config: ${cfg.kind}`);

  const { h, m } = hmsOf(params.ts);
  // 12시 방향 = -π/2. 시계 좌표계와 맞춘다.
  // 초침 로브는 없다 (v1.2에서 초침 제거) — phase(초의 연속 위상)가
  // 분침 로브를 매끄럽게 밀고 간다. 뚝뚝 끊기는 값이 없다.
  const minA = ((m + params.phase) / 60) * TAU - Math.PI / 2;
  const hourA = (((h % 12) + (m + params.phase) / 60) / 12) * TAU - Math.PI / 2;
  const lobes: { angle: number; w: number; sharp: number }[] = [
    { angle: minA, w: 0.8, sharp: 18 },
    { angle: hourA, w: 1.0, sharp: 9 },
  ];

  for (let py = 0; py < res; py++) {
    const y = py / (res - 1) - 0.5;
    for (let px = 0; px < res; px++) {
      const x = px / (res - 1) - 0.5;
      const r = Math.hypot(x, y) * 2; // 0(중심) ~ ≥1(모서리)
      const theta = Math.atan2(y, x);

      const tw = theta + cfg.twist * r + params.phase * TAU * 0.15;
      const ring = 0.5 + 0.5 * Math.sin(r * cfg.rings * Math.PI);
      const spoke = 0.5 + 0.5 * Math.sin(tw * cfg.spokes);
      let v = ring * 0.55 + spoke * 0.45;

      // 바늘 로브 — 각도 차 가우시안
      let hand = 0;
      for (const lobe of lobes) {
        let d = theta - lobe.angle;
        d = Math.atan2(Math.sin(d), Math.cos(d)); // [-π, π]
        hand += lobe.w * Math.exp(-d * d * lobe.sharp);
      }
      v += cfg.handInfluence * hand * (1 - r * 0.5);

      v *= Math.exp(-Math.max(0, r - 0.15) * cfg.falloff);
      buf[py * res + px] = Math.min(1, Math.max(0, v));
    }
  }
}
