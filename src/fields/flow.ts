// F5 flow — 흐름장 (SPEC §6).
// 노이즈 각도장을 따라 입자를 흘려 밀도를 누적한다.
// 512 필드에서만 돌므로 입자 수는 200~600으로 충분하다.
// phase는 각도장을 천천히 회전시킨다.

import { createNoise2D } from 'simplex-noise';
import type { FieldArgs } from './index';

const TAU = Math.PI * 2;

export function flow(a: FieldArgs): void {
  const { buf, res, params, rng } = a;
  const cfg = params.fieldConfig;
  if (cfg.kind !== 'flow') throw new Error(`wrong config: ${cfg.kind}`);

  buf.fill(0);
  const n2 = createNoise2D(rng);
  const drift = params.phase * TAU * 0.12;

  // 지터 격자 시작점
  const grid = Math.ceil(Math.sqrt(cfg.particles));
  for (let i = 0; i < cfg.particles; i++) {
    const gx = i % grid;
    const gy = Math.floor(i / grid);
    let x = (gx + 0.2 + rng() * 0.6) / grid;
    let y = (gy + 0.2 + rng() * 0.6) / grid;

    let deposit = 1;
    for (let step = 0; step < cfg.steps; step++) {
      const ang = n2(x * cfg.noiseScale, y * cfg.noiseScale) * Math.PI * 1.6 + drift;
      x += Math.cos(ang) * cfg.stepLen;
      y += Math.sin(ang) * cfg.stepLen;
      if (x < 0 || x >= 1 || y < 0 || y >= 1) break;
      splat(buf, res, x, y, deposit);
      deposit *= cfg.decay;
    }
  }

  // 정규화 — 누적 최댓값 기준. 상위 몇 픽셀에 끌려가지 않게 소프트 클립
  let max = 0;
  for (let i = 0; i < buf.length; i++) if ((buf[i] ?? 0) > max) max = buf[i] ?? 0;
  if (max > 0) {
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] ?? 0) / max;
      buf[i] = 1 - Math.exp(-v * 3.2); // 부드러운 톤 커브
    }
  }
}

function splat(buf: Float32Array, res: number, x: number, y: number, v: number): void {
  const px = Math.floor(x * res);
  const py = Math.floor(y * res);
  const i = py * res + px;
  buf[i] = (buf[i] ?? 0) + v;
  // 3×3 십자 소량 확산 — 궤적이 1px 실선으로 끊겨 보이지 않게
  if (px > 0) buf[i - 1] = (buf[i - 1] ?? 0) + v * 0.35;
  if (px < res - 1) buf[i + 1] = (buf[i + 1] ?? 0) + v * 0.35;
  if (py > 0) buf[i - res] = (buf[i - res] ?? 0) + v * 0.35;
  if (py < res - 1) buf[i + res] = (buf[i + res] ?? 0) + v * 0.35;
}
