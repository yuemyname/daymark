// 이펙트 4종 — 드로우 콜 결정성 + 해상도 독립.
// L2 트레이스 스냅샷(W4.3)도 여기서 기록한다.

import { describe, expect, it } from 'vitest';
import { cyrb128, rngFor } from '../src/core/rng';
import { bilinearSampler } from '../src/core/sampler';
import { minuteKey } from '../src/core/time';
import { effects } from '../src/effects';
import { fields } from '../src/fields';
import { effectConfigFor, fieldConfigFor } from '../src/params';
import {
  EFFECT_IDS,
  FIELD_IDS,
  type EffectId,
  type FieldId,
  type Params,
} from '../src/params/types';
import { makeTraceCtx } from './helpers/traceCtx';

const RES = 128;

function comboParams(field: FieldId, effect: EffectId, ts: string): Params {
  const mk = minuteKey(ts);
  return {
    ts,
    field,
    effect,
    tone: { mode: 'paper', blur: 0, grain: 0, gamma: 1, blackPoint: 0, whitePoint: 1 },
    seedHex: '000000',
    fieldConfig: fieldConfigFor(field, rngFor(mk + ':config')),
    effectConfig: effectConfigFor(effect, rngFor(mk + ':config:e')),
    phase: 7 / 60,
  };
}

function renderTrace(field: FieldId, effect: EffectId, ts: string, size: number): string[] {
  const params = comboParams(field, effect, ts);
  const buf = new Float32Array(RES * RES);
  fields[field]({ buf, res: RES, params, rng: rngFor(minuteKey(ts) + ':field') });
  const { ctx, trace } = makeTraceCtx();
  effects[effect]({
    ctx,
    size,
    lum: bilinearSampler(buf, RES),
    ink: '#000',
    params,
    rng: rngFor(minuteKey(ts) + ':effect'),
  });
  return trace;
}

describe.each(EFFECT_IDS)('%s', (effect) => {
  const ts = '2026-07-30T14:23:07';

  it('같은 ts → 트레이스가 완전히 같다', () => {
    expect(renderTrace('noise', effect, ts, 720)).toEqual(renderTrace('noise', effect, ts, 720));
  });

  it('다른 분 → 다른 트레이스', () => {
    expect(renderTrace('noise', effect, ts, 720)).not.toEqual(
      renderTrace('noise', effect, '2026-07-30T14:41:07', 720),
    );
  });

  it('해상도 독립 — 720과 4096의 트레이스 구조 (§9)', () => {
    const a = renderTrace('subdivision', effect, ts, 720);
    const b = renderTrace('subdivision', effect, ts, 4096);
    if (effect === 'dither') {
      // §9의 유일한 예외 — 디더 픽셀은 출력 크기에 비례하므로 트레이스가 다른 게 맞다
      expect(a.length).toBeGreaterThan(0);
      expect(b.length).toBeGreaterThan(0);
    } else {
      // 유닛 스케일 — scale() 한 줄만 다르다
      expect(a.length).toBe(b.length);
      const diff = a.filter((line, i) => line !== b[i]);
      expect(diff.length).toBe(1);
      expect(diff[0]).toContain('scale');
    }
  });
});

describe('L2 — 트레이스 스냅샷 (필드 5 × 이펙트 4)', () => {
  it('20조합의 트레이스 해시가 기록과 일치한다', () => {
    const record: Record<string, string> = {};
    for (const field of FIELD_IDS) {
      for (const effect of EFFECT_IDS) {
        const trace = renderTrace(field, effect, '2026-07-30T14:23:07', 720);
        record[`${field}/${effect}`] = cyrb128(trace.join('\n'))
          .map((h) => h.toString(16).padStart(8, '0'))
          .join('');
      }
    }
    expect(record).toMatchSnapshot();
  });
});
