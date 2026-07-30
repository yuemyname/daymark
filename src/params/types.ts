// SPEC §5 — 시드 / 파라미터 / 렌더 3단 분리의 가운데 층.
// 렌더는 rng를 직접 뒤지지 않고 이 명시적 파라미터 객체를 받는다.

import type { Palette } from '../core/palette';

export const SYSTEM_IDS = [
  'flowfield',
  'packing',
  'truchet',
  'subdivision',
  'interference',
] as const;

export type SystemId = (typeof SYSTEM_IDS)[number];

// --- 시스템별 config (SPEC §6) ---

export type FlowfieldConfig = {
  kind: 'flowfield';
  noiseScale: number;
  particles: number;
  steps: number;
  stepLen: number;
  alpha: number;
  taper: number;
  turns: number;
};

export type PackingStyle = 'solid' | 'ring' | 'nested' | 'mixed';
export type PackingMask = 'none' | 'dateGlyph';

export type PackingConfig = {
  kind: 'packing';
  attempts: number;
  minR: number;
  maxR: number;
  padding: number;
  style: PackingStyle;
  mask: PackingMask;
};

export type TruchetVariant = 'arc' | 'diagonal' | 'maze' | 'arcThick';

export type TruchetConfig = {
  kind: 'truchet';
  grid: number;
  variant: TruchetVariant;
  subdivide: number;
  weight: number;
};

export type LeafMix = {
  solid: number;
  hatch: number;
  empty: number;
  concentric: number;
};

export type SubdivisionConfig = {
  kind: 'subdivision';
  maxDepth: number;
  splitBias: number;
  minSize: number;
  leafMix: LeafMix;
  gutter: number;
};

export type InterferenceLayer = {
  angle: number;
  freq: number;
  amp: number;
  phase: number;
  weight: number;
};

export type InterferenceConfig = {
  kind: 'interference';
  layers: InterferenceLayer[];
  blend: 'source-over' | 'multiply';
};

export type SystemConfig =
  | FlowfieldConfig
  | PackingConfig
  | TruchetConfig
  | SubdivisionConfig
  | InterferenceConfig;

export type Params = {
  dateKey: string;
  system: SystemId;
  palette: Palette;
  seedHex: string; // 화면에 표시할 시드 지문
  config: SystemConfig;
};
