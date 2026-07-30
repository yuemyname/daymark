// SPEC §5 — dateKey → Params.
//
// rng 스트림 분리:
//   dateKey + ':system' — 시스템 추첨 전용. 새 시스템을 추가해도 다른 날의
//                         팔레트·config가 흔들리지 않게 따로 뗀다.
//   dateKey + ':params' — 팔레트 + 시스템 config.
//   dateKey + ':render' — 렌더 전용 (systems/ 쪽에서 새로 만든다).
// 같은 rng를 이어 쓰면 파라미터 하나를 추가하는 순간 그 뒤 모든 날이 바뀐다.

import { addDays, diffDays, isValidDateKey } from '../core/date';
import { rngFor, seedHexFor } from '../core/rng';
import { paletteFor } from '../core/palette';
import type {
  InterferenceLayer,
  Params,
  SystemConfig,
  SystemId,
} from './types';
import { SYSTEM_IDS } from './types';

// --- 시스템 선택 (SPEC §5.1) ---

// 가중치. dateGlyph를 품은 packing이 시그니처라 살짝 높다.
const WEIGHTS: Record<SystemId, number> = {
  flowfield: 1,
  packing: 1.2,
  truchet: 1,
  subdivision: 1,
  interference: 0.8,
};

// 직전 2일 회피는 이 날짜부터 순방향으로만 계산한다.
// EPOCH 이전 날짜는 회피 없이 단독 추첨 — 기준점이 없으면 재귀가 끝나지 않는다.
export const EPOCH = '2026-01-01';

function drawWeighted(rng: () => number): SystemId {
  const total = SYSTEM_IDS.reduce((s, id) => s + WEIGHTS[id], 0);
  let t = rng() * total;
  for (const id of SYSTEM_IDS) {
    t -= WEIGHTS[id];
    if (t < 0) return id;
  }
  return SYSTEM_IDS[SYSTEM_IDS.length - 1] as SystemId;
}

/** 가중치 추첨 후, 직전 2일과 겹치면 재추첨 (최대 4회). */
function drawSystem(rng: () => number, avoid: ReadonlySet<SystemId>): SystemId {
  let picked = drawWeighted(rng);
  for (let i = 0; i < 4 && avoid.has(picked); i++) {
    picked = drawWeighted(rng);
  }
  return picked;
}

const systemMemo = new Map<string, SystemId>();

/** 과거 날짜로부터 순수하게 계산되므로 결정성은 유지된다. */
export function systemFor(dateKey: string): SystemId {
  if (!isValidDateKey(dateKey)) throw new Error(`invalid dateKey: ${dateKey}`);
  const cached = systemMemo.get(dateKey);
  if (cached) return cached;

  const gap = diffDays(EPOCH, dateKey);
  if (gap <= 0) {
    const sys = drawWeighted(rngFor(dateKey + ':system'));
    systemMemo.set(dateKey, sys);
    return sys;
  }

  // EPOCH부터 순방향으로 채운다. 재귀 대신 반복 — 수천 일이어도 싸다.
  let prev1 = systemFor(addDays(EPOCH, 0));
  let prev2: SystemId | null = null;
  for (let i = 1; i <= gap; i++) {
    const key = addDays(EPOCH, i);
    let sys = systemMemo.get(key);
    if (!sys) {
      const avoid = new Set<SystemId>(prev2 ? [prev1, prev2] : [prev1]);
      sys = drawSystem(rngFor(key + ':system'), avoid);
      systemMemo.set(key, sys);
    }
    prev2 = prev1;
    prev1 = sys;
  }
  return prev1;
}

// --- 시스템별 config 생성 (SPEC §6의 권장 범위) ---

function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  const v = arr[Math.floor(rng() * arr.length)];
  if (v === undefined) throw new Error('pick from empty array');
  return v;
}

/** JSON 스냅샷(L1)을 사람이 읽을 수 있게 소수 4자리로 자른다. */
function r4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export function configFor(system: SystemId, rng: () => number): SystemConfig {
  switch (system) {
    case 'flowfield':
      return {
        kind: 'flowfield',
        noiseScale: r4(range(rng, 0.8, 3.0)),
        particles: int(rng, 300, 1200),
        steps: int(rng, 40, 200),
        stepLen: r4(range(rng, 0.002, 0.006)),
        alpha: r4(range(rng, 0.03, 0.12)),
        taper: r4(range(rng, 0.3, 0.9)),
        turns: r4(range(rng, 0.5, 3)),
      };
    case 'packing':
      return {
        kind: 'packing',
        attempts: int(rng, 1000, 3000),
        minR: r4(range(rng, 0.002, 0.006)),
        maxR: r4(range(rng, 0.04, 0.12)),
        padding: r4(range(rng, 0.001, 0.004)),
        style: pick(rng, ['solid', 'ring', 'nested', 'mixed'] as const),
        mask: rng() < 0.3 ? 'dateGlyph' : 'none',
      };
    case 'truchet':
      return {
        kind: 'truchet',
        grid: int(rng, 6, 14),
        variant: pick(rng, ['arc', 'diagonal', 'maze', 'arcThick'] as const),
        subdivide: r4(range(rng, 0.15, 0.5)),
        weight: r4(range(rng, 0.04, 0.14)),
      };
    case 'subdivision': {
      // leafMix — 4개 가중치를 뽑아 확률 분포로 정규화
      const w = [rng(), rng(), rng(), rng()] as const;
      const sum = w[0] + w[1] + w[2] + w[3];
      return {
        kind: 'subdivision',
        maxDepth: int(rng, 4, 7),
        splitBias: r4(range(rng, 0.2, 0.8)),
        minSize: r4(range(rng, 0.02, 0.06)),
        leafMix: {
          solid: r4(w[0] / sum),
          hatch: r4(w[1] / sum),
          empty: r4(w[2] / sum),
          concentric: r4(w[3] / sum),
        },
        gutter: rng() < 0.5 ? 0 : r4(range(rng, 0.004, 0.02)),
      };
    }
    case 'interference': {
      const layerCount = int(rng, 2, 3);
      const layers: InterferenceLayer[] = [];
      for (let i = 0; i < layerCount; i++) {
        layers.push({
          angle: r4(range(rng, 0, Math.PI)),
          freq: r4(range(rng, 40, 140)),
          amp: r4(range(rng, 0.002, 0.02)),
          phase: r4(range(rng, 0, Math.PI * 2)),
          weight: r4(range(rng, 0.001, 0.004)),
        });
      }
      return {
        kind: 'interference',
        layers,
        blend: rng() < 0.5 ? 'multiply' : 'source-over',
      };
    }
  }
}

/** dateKey 하나로부터 그날의 모든 것이 결정된다. */
export function paramsFor(dateKey: string): Params {
  if (!isValidDateKey(dateKey)) throw new Error(`invalid dateKey: ${dateKey}`);
  const system = systemFor(dateKey);
  const paramRng = rngFor(dateKey + ':params');
  const palette = paletteFor(paramRng);
  const config = configFor(system, paramRng);
  return {
    dateKey,
    system,
    palette,
    seedHex: seedHexFor(dateKey),
    config,
  };
}
