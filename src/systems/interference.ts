// S5 interference — 간섭 줄무늬 (SPEC §6).
// 서로 다른 각도·주기의 선 다발을 겹쳐 모아레를 만든다.
// 각 선은 직선이 아니라 사인 합으로 변위를 준다.
// 레이어 2~3개면 충분 — 4개 넘으면 회색 죽이 된다.

import { enterUnitSpace, exitUnitSpace } from '../core/canvas';
import type { RenderArgs } from './index';

const SAMPLES_PER_LINE = 64;
const LINES_PER_STEP = 24;

export function* interference(a: RenderArgs): Generator<void, void, void> {
  const { ctx, size, params } = a;
  const cfg = params.config;
  if (cfg.kind !== 'interference') throw new Error(`wrong config: ${cfg.kind}`);
  const inks = params.palette.inks;

  enterUnitSpace(ctx, size);
  ctx.fillStyle = params.palette.bg;
  ctx.fillRect(0, 0, 1, 1);
  yield;

  // multiply는 어두운 배경에서 전부 검정으로 죽는다 — dark 모드는 일반 합성으로
  ctx.globalCompositeOperation =
    params.palette.mode === 'dark' ? 'source-over' : cfg.blend;

  for (let li = 0; li < cfg.layers.length; li++) {
    const layer = cfg.layers[li];
    const ink = inks[li % inks.length];
    if (!layer || ink === undefined) continue;

    const dx = Math.cos(layer.angle);
    const dy = Math.sin(layer.angle);
    // 법선 방향 (선 다발이 늘어서는 축)
    const nx = -dy;
    const ny = dx;

    ctx.strokeStyle = ink;
    ctx.lineWidth = layer.weight;

    // freq ≈ 선 개수. 캔버스 대각선을 덮도록 [-0.75, 0.75] 범위에 배치
    const count = Math.round(layer.freq);
    for (let j = 0; j < count; j++) {
      const u = -0.75 + (1.5 * j) / (count - 1);
      ctx.beginPath();
      for (let sIdx = 0; sIdx <= SAMPLES_PER_LINE; sIdx++) {
        const t = sIdx / SAMPLES_PER_LINE;
        const along = (t - 0.5) * 1.6;
        // 사인 합 변위 — 선 위치(u)에 따라 위상이 밀리며 모아레가 생긴다
        const wobble =
          layer.amp * Math.sin(t * Math.PI * 2 * 3 + layer.phase + u * 14) +
          layer.amp * 0.5 * Math.sin(t * Math.PI * 2 * 7 + layer.phase * 2);
        const x = 0.5 + dx * along + nx * (u + wobble);
        const y = 0.5 + dy * along + ny * (u + wobble);
        if (sIdx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (j % LINES_PER_STEP === LINES_PER_STEP - 1) yield;
    }
    yield;
  }

  ctx.globalCompositeOperation = 'source-over';
  exitUnitSpace(ctx);
}
