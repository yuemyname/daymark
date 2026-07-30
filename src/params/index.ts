// SPEC §2.3 / §5 — ts → Params. 계층 시드:
//   hourKey + ':pick'     — 이펙트·필드 종류 (1시간)
//   minuteKey + ':config' — 구조 파라미터 + 톤 (1분)
//   초                    — rng 없음. phase = s/60 연속값만
// 세 rng를 분리해서 각각 새로 만든다. 이어 쓰면 파라미터 하나를 추가하는
// 순간 그 뒤 모든 시각의 그림이 전부 바뀐다.

import { rngFor, seedHexFor } from '../core/rng';
import { addHours, hourKey, isValidTsKey, minuteKey, secondOf } from '../core/time';
import { toneFor } from '../core/tone';
import type {
  EffectConfig,
  EffectId,
  FieldConfig,
  FieldId,
  InterferenceLayer,
  Params,
} from './types';
import { EFFECT_IDS, FIELD_IDS } from './types';

// --- 조합 선택 (SPEC §5.1) ---

const EFFECT_WEIGHTS: Record<EffectId, number> = {
  dots: 1.2,
  dither: 1,
  stipple: 1,
  steps: 0.9,
};

// 궁합표 (SPEC §7). 궁합 좋은 필드 1, 나머지는 낮게. 못 쓸 조합은 0에 가깝게.
const AFFINITY: Record<EffectId, Record<FieldId, number>> = {
  dots: { noise: 1, radial: 1, flow: 1, interference: 0.3, subdivision: 0.3 },
  dither: { noise: 1, interference: 1, flow: 1, radial: 0.3, subdivision: 0.1 },
  stipple: { radial: 1, subdivision: 1, noise: 0.35, interference: 0.3, flow: 0.3 },
  steps: { interference: 1, subdivision: 1, noise: 0.35, radial: 0.3, flow: 0.2 },
};

function drawWeightedEffect(rng: () => number): EffectId {
  const total = EFFECT_IDS.reduce((s, id) => s + EFFECT_WEIGHTS[id], 0);
  let t = rng() * total;
  for (const id of EFFECT_IDS) {
    t -= EFFECT_WEIGHTS[id];
    if (t < 0) return id;
  }
  return EFFECT_IDS[EFFECT_IDS.length - 1] as EffectId;
}

function drawField(rng: () => number, effect: EffectId): FieldId {
  const w = AFFINITY[effect];
  const total = FIELD_IDS.reduce((s, id) => s + w[id], 0);
  let t = rng() * total;
  for (const id of FIELD_IDS) {
    t -= w[id];
    if (t < 0) return id;
  }
  return FIELD_IDS[FIELD_IDS.length - 1] as FieldId;
}

/** 해당 시(hour)의 "원추첨" — 회피 없는 첫 추첨. 이웃 시의 회피 집합 계산용. */
function rawEffect(hk: string): EffectId {
  return drawWeightedEffect(rngFor(hk + ':pick'));
}

/**
 * 이펙트 추첨 — 직전 2시간과 겹치면 재추첨 (최대 4회).
 * 회피 집합은 직전 2시간의 원추첨으로 만든다 (O(1), 과거 전체 재귀 없음).
 * 드물게 연속 중복이 샐 수 있지만 어떤 시각이든 결과는 순수하게 결정적이다.
 */
export function pickFor(hk: string): { effect: EffectId; field: FieldId } {
  const avoid = new Set<EffectId>([rawEffect(addHours(hk, -1)), rawEffect(addHours(hk, -2))]);
  const rng = rngFor(hk + ':pick');
  let effect = drawWeightedEffect(rng); // 첫 추첨 == 이 시의 원추첨
  for (let i = 0; i < 4 && avoid.has(effect); i++) {
    effect = drawWeightedEffect(rng);
  }
  const field = drawField(rng, effect);
  return { effect, field };
}

// --- config 생성 (분 단위, SPEC §6~§7 권장 범위) ---

function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pickOf<T>(rng: () => number, arr: readonly T[]): T {
  const v = arr[Math.floor(rng() * arr.length)];
  if (v === undefined) throw new Error('pick from empty array');
  return v;
}

/** L1 스냅샷을 사람이 읽을 수 있게 소수 4자리로 자른다. */
function r4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export function fieldConfigFor(field: FieldId, rng: () => number): FieldConfig {
  switch (field) {
    case 'noise':
      return {
        kind: 'noise',
        scale: r4(range(rng, 1.5, 6)),
        octaves: int(rng, 1, 3),
        warp: r4(range(rng, 0, 0.4)),
        ridged: rng() < 0.3,
      };
    case 'radial': {
      // rings는 12·60의 배수를 피한다 — 시계 눈금과 주기가 겹치면 뻔해진다 (§6 F2)
      let rings = int(rng, 5, 23);
      if (rings % 12 === 0) rings += 1;
      return {
        kind: 'radial',
        rings,
        spokes: int(rng, 3, 11),
        twist: r4(range(rng, -1.2, 1.2)),
        falloff: r4(range(rng, 0.4, 1.6)),
        handInfluence: r4(range(rng, 0.25, 0.75)),
      };
    }
    case 'interference': {
      const layerCount = int(rng, 2, 3);
      const layers: InterferenceLayer[] = [];
      for (let i = 0; i < layerCount; i++) {
        layers.push({
          angle: r4(range(rng, 0, Math.PI)),
          freq: r4(range(rng, 6, 28)),
          amp: r4(range(rng, 0.2, 0.8)),
          phaseOffset: r4(range(rng, 0, Math.PI * 2)),
          speed: r4(range(rng, 0.5, 1.5)), // §6 F3 — 배속 차는 0.5×~1.5× 안에서
        });
      }
      return { kind: 'interference', layers };
    }
    case 'subdivision':
      return {
        kind: 'subdivision',
        maxDepth: int(rng, 4, 7),
        splitBias: r4(range(rng, 0.2, 0.8)),
        minSize: r4(range(rng, 0.03, 0.08)),
        gutter: rng() < 0.4 ? 0 : r4(range(rng, 0.004, 0.016)),
      };
    case 'flow':
      return {
        kind: 'flow',
        noiseScale: r4(range(rng, 0.8, 3)),
        particles: int(rng, 200, 600),
        steps: int(rng, 40, 120),
        stepLen: r4(range(rng, 0.002, 0.006)),
        decay: r4(range(rng, 0.9, 0.995)),
      };
  }
}

export function effectConfigFor(effect: EffectId, rng: () => number): EffectConfig {
  switch (effect) {
    case 'dots':
      return {
        kind: 'dots',
        grid: int(rng, 20, 48),
        angle: r4(range(rng, 0, Math.PI / 2)),
        gridType: rng() < 0.4 ? 'benday' : 'regular',
        minR: r4(range(rng, 0.02, 0.08)),
        maxR: r4(range(rng, 0.42, 0.58)),
        cornerRadius: rng() < 0.7 ? 1 : r4(range(rng, 0.1, 0.5)),
      };
    case 'dither':
      return {
        kind: 'dither',
        pattern: pickOf(rng, ['bayer2', 'bayer4', 'bayer8', 'fs'] as const),
        pixelSize: int(rng, 6, 14),
        threshold: r4(range(rng, -0.08, 0.08)),
      };
    case 'stipple':
      return {
        kind: 'stipple',
        xSquares: int(rng, 18, 44),
        ySquares: int(rng, 18, 44),
        angle: r4(range(rng, 0, Math.PI)),
        minW: r4(range(rng, 0.02, 0.08)),
        maxW: r4(range(rng, 0.5, 0.9)),
      };
    case 'steps':
      return {
        kind: 'steps',
        stepSize: r4(range(rng, 0.02, 0.045)),
        shape: rng() < 0.5 ? 'rect' : 'ellipse',
        levels: int(rng, 3, 6),
      };
  }
}

/**
 * 타임스탬프 하나로부터 그 순간의 모든 것이 결정된다.
 * fracSecond(0~1)를 주면 phase가 초 사이를 연속으로 채운다 —
 * 화면이 1Hz로 뚝뚝 끊기지 않게 하는 장치. rng에는 절대 들어가지 않는다.
 */
export function paramsFor(ts: string, fracSecond = 0): Params {
  if (!isValidTsKey(ts)) throw new Error(`invalid ts: ${ts}`);
  const hk = hourKey(ts);
  const mk = minuteKey(ts);

  const { effect, field } = pickFor(hk);

  const cfgRng = rngFor(mk + ':config');
  const fieldConfig = fieldConfigFor(field, cfgRng);
  const effectConfig = effectConfigFor(effect, cfgRng);
  const tone = toneFor(ts, cfgRng);

  return {
    ts,
    field,
    effect,
    tone,
    seedHex: seedHexFor(mk),
    fieldConfig,
    effectConfig,
    phase: Math.min(59.999, secondOf(ts) + Math.min(0.999, Math.max(0, fracSecond))) / 60,
  };
}
