// SPEC §5 — dateKey → Params.
//
// rng 스트림 분리:
//   dateKey + ':system' — 시스템 추첨 전용. 새 시스템을 추가해도 다른 날의
//                         팔레트·config가 흔들리지 않게 따로 뗀다.
//   dateKey + ':params' — 팔레트 + 시스템 config.
//   dateKey + ':render' — 렌더 전용 (systems/ 쪽에서 새로 만든다).
// 같은 rng를 이어 쓰면 파라미터 하나를 추가하는 순간 그 뒤 모든 날이 바뀐다.

import { addMinutes, isValidPlateKey } from '../core/date';
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

function drawWeighted(rng: () => number): SystemId {
  const total = SYSTEM_IDS.reduce((s, id) => s + WEIGHTS[id], 0);
  let t = rng() * total;
  for (const id of SYSTEM_IDS) {
    t -= WEIGHTS[id];
    if (t < 0) return id;
  }
  return SYSTEM_IDS[SYSTEM_IDS.length - 1] as SystemId;
}

/** 해당 키의 "원추첨" — 회피 없이 첫 추첨만. 이웃 키의 회피 집합 계산에 쓴다. */
function rawDraw(key: string): SystemId {
  return drawWeighted(rngFor(key + ':system'));
}

/**
 * 가중치 추첨 후, 직전 2분과 겹치면 재추첨 (최대 4회).
 *
 * 회피 집합은 직전 2분의 "원추첨"으로 만든다. 진짜 최종 선택으로 만들면
 * 과거 전체를 재귀해야 해서 (분 단위에선 연간 52만 스텝) O(1)로 타협한 것.
 * 원추첨과 최종이 달랐던 분 뒤에서는 드물게 연속 중복이 샐 수 있지만,
 * 어떤 키에 대해서도 결과는 순수하게 결정적이다.
 */
export function systemFor(key: string): SystemId {
  if (!isValidPlateKey(key)) throw new Error(`invalid plateKey: ${key}`);
  const avoid = new Set<SystemId>([rawDraw(addMinutes(key, -1)), rawDraw(addMinutes(key, -2))]);
  const rng = rngFor(key + ':system');
  let picked = drawWeighted(rng); // 첫 추첨 == 이 키의 원추첨
  for (let i = 0; i < 4 && avoid.has(picked); i++) {
    picked = drawWeighted(rng);
  }
  return picked;
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
      // W4.3 튜닝: 격자를 줄이고 선을 키워 무늬가 또렷하게
      return {
        kind: 'truchet',
        grid: int(rng, 5, 10),
        variant: pick(rng, ['arc', 'diagonal', 'maze', 'arcThick'] as const),
        subdivide: r4(range(rng, 0.15, 0.5)),
        weight: r4(range(rng, 0.06, 0.16)),
      };
    case 'subdivision': {
      // leafMix — 4개 가중치를 뽑아 확률 분포로 정규화.
      // W4.3 튜닝: empty가 판을 통째로 비워버리는 날이 잦아서 반으로 감쇠
      const w = [rng(), rng(), rng() * 0.5, rng()] as const;
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
      // W4.3 튜닝: freq 상한을 내리고 선을 살짝 키움 — 140까지 가면 회색 죽이 된다
      const layerCount = int(rng, 2, 3);
      const layers: InterferenceLayer[] = [];
      for (let i = 0; i < layerCount; i++) {
        layers.push({
          angle: r4(range(rng, 0, Math.PI)),
          freq: r4(range(rng, 30, 90)),
          amp: r4(range(rng, 0.004, 0.02)),
          phase: r4(range(rng, 0, Math.PI * 2)),
          weight: r4(range(rng, 0.0015, 0.0045)),
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

/** 판 키(분 단위) 하나로부터 그 판의 모든 것이 결정된다. */
export function paramsFor(key: string): Params {
  if (!isValidPlateKey(key)) throw new Error(`invalid plateKey: ${key}`);
  const system = systemFor(key);
  const paramRng = rngFor(key + ':params');
  const palette = paletteFor(paramRng);
  const config = configFor(system, paramRng);
  return {
    dateKey: key,
    system,
    palette,
    seedHex: seedHexFor(key),
    config,
  };
}
