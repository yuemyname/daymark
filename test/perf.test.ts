// SPEC §12 L3 — 성능 회귀 (필드 5 × 이펙트 4 = 20조합).
// 매초 도는 렌더러에서 이 테스트가 없으면 성능은 반드시 조용히 무너진다.
//
// Node에는 래스터화가 없으므로(트레이스 ctx) 브라우저 절대치와 다르다.
// 예산은 §13(iPad 40ms/80ms)보다 느슨하게 잡되, 마크 개수 폭발 같은
// 회귀는 확실히 잡히는 수준으로 둔다.

import { describe, expect, it } from 'vitest';
import { rngFor } from '../src/core/rng';
import { bilinearSampler } from '../src/core/sampler';
import { applyTone } from '../src/core/tone';
import { effects } from '../src/effects';
import { FIELD_RES, fields } from '../src/fields';
import { effectConfigFor, fieldConfigFor } from '../src/params';
import {
  EFFECT_IDS,
  FIELD_IDS,
  type EffectId,
  type FieldId,
  type Params,
} from '../src/params/types';

const FIELD_BUDGET_MS = 200; // §13: 40ms (iPad) — Node 여유분 포함
const EFFECT_BUDGET_MS = 300; // §13: 80ms (iPad) — 래스터 없는 대신 여유

const noopCtx = new Proxy(
  {},
  { get: () => () => undefined, set: () => true },
) as unknown as CanvasRenderingContext2D;

function comboParams(field: FieldId, effect: EffectId): Params {
  return {
    ts: '2026-07-30T14:23:07',
    field,
    effect,
    tone: { mode: 'paper', blur: 0.008, grain: 0.08, gamma: 1.1, blackPoint: 0.05, whitePoint: 0.95 },
    seedHex: '000000',
    fieldConfig: fieldConfigFor(field, rngFor(`perf:${field}`)),
    effectConfig: effectConfigFor(effect, rngFor(`perf:${effect}`)),
    phase: 0.42,
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

const buf = new Float32Array(FIELD_RES * FIELD_RES);

describe('L3 — 성능 회귀', () => {
  it.each(FIELD_IDS)('필드 %s ≤ %dms', (field) => {
    const params = comboParams(field, 'dots');
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      fields[field]({ buf, res: FIELD_RES, params, rng: rngFor('perf:f') });
      applyTone(buf, FIELD_RES, params.tone, rngFor('perf:g'));
      times.push(performance.now() - t0);
    }
    expect(median(times), `${field} 필드+톤`).toBeLessThan(FIELD_BUDGET_MS);
  });

  it.each(EFFECT_IDS)('이펙트 %s — 모든 필드에서 ≤ %dms', (effect) => {
    for (const field of FIELD_IDS) {
      const params = comboParams(field, effect);
      fields[field]({ buf, res: FIELD_RES, params, rng: rngFor('perf:f') });
      applyTone(buf, FIELD_RES, params.tone, rngFor('perf:g'));
      const lum = bilinearSampler(buf, FIELD_RES);
      const times: number[] = [];
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        effects[effect]({ ctx: noopCtx, size: 720, lum, ink: '#000', params, rng: rngFor('perf:e') });
        times.push(performance.now() - t0);
      }
      expect(median(times), `${field}/${effect}`).toBeLessThan(EFFECT_BUDGET_MS);
    }
  });
});
