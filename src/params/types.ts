// SPEC §5 — 시드 / 파라미터 / 필드 / 이펙트 4단 분리의 파라미터 층.

import type { Tone } from '../core/tone';

export const FIELD_IDS = ['noise', 'radial', 'interference', 'subdivision', 'flow'] as const;
export type FieldId = (typeof FIELD_IDS)[number];

// v1은 E1~E4 네 종만. edge/displace/automata/ascii는 v1.1 (SPEC §7)
export const EFFECT_IDS = ['dots', 'dither', 'stipple', 'steps'] as const;
export type EffectId = (typeof EFFECT_IDS)[number];

// --- 필드 config (SPEC §6) ---

export type NoiseConfig = {
  kind: 'noise';
  scale: number;
  octaves: number;
  warp: number;
  ridged: boolean;
};

export type RadialConfig = {
  kind: 'radial';
  rings: number;
  spokes: number;
  twist: number;
  falloff: number;
  handInfluence: number;
};

export type InterferenceLayer = {
  angle: number;
  freq: number;
  amp: number;
  phaseOffset: number;
  speed: number; // phase 배속 0.5~1.5 (§6 F3)
};

export type InterferenceConfig = {
  kind: 'interference';
  layers: InterferenceLayer[];
};

export type SubdivisionConfig = {
  kind: 'subdivision';
  maxDepth: number;
  splitBias: number;
  minSize: number;
  gutter: number;
};

export type FlowConfig = {
  kind: 'flow';
  noiseScale: number;
  particles: number;
  steps: number;
  stepLen: number;
  decay: number;
};

export type FieldConfig =
  | NoiseConfig
  | RadialConfig
  | InterferenceConfig
  | SubdivisionConfig
  | FlowConfig;

// --- 이펙트 config (SPEC §7) ---

export type DotsConfig = {
  kind: 'dots';
  grid: number;
  angle: number;
  gridType: 'regular' | 'benday';
  minR: number;
  maxR: number;
  cornerRadius: number; // 1 = 원, 0 = 사각
};

export type DitherConfig = {
  kind: 'dither';
  pattern: 'bayer2' | 'bayer4' | 'bayer8' | 'fs';
  pixelSize: number; // 출력 픽셀 기준 (1024 기준값, §9 예외)
  threshold: number;
};

export type StippleConfig = {
  kind: 'stipple';
  xSquares: number;
  ySquares: number;
  angle: number;
  minW: number;
  maxW: number;
};

export type StepsConfig = {
  kind: 'steps';
  stepSize: number; // 셀 한 변 (유닛)
  shape: 'rect' | 'ellipse';
  levels: number;
};

export type EffectConfig = DotsConfig | DitherConfig | StippleConfig | StepsConfig;

export type Params = {
  ts: string;
  field: FieldId;
  effect: EffectId;
  tone: Tone;
  seedHex: string; // 화면에 표시할 지문 (분 키 기준 — 초마다 바뀌면 노이즈다)
  fieldConfig: FieldConfig;
  effectConfig: EffectConfig;
  phase: number; // [0,1) 초 위상
};
