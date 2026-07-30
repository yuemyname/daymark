// SPEC §5 / §7 — 이펙트: 회색조 밀도를 샘플링해 흑백 마크로 옮긴다.
// 색은 없다. 잉크 색(fg)은 호출자가 톤 믹스로 결정해 넘긴다.
// 배경은 호출자가 미리 칠한다 — 이펙트는 마크만 그린다.

import type { EffectId, Params } from '../params/types';
import type { Lum } from '../core/sampler';
import { dots } from './dots';
import { dither } from './dither';
import { stipple } from './stipple';
import { steps } from './steps';

export type EffectArgs = {
  ctx: CanvasRenderingContext2D;
  size: number; // 정사각 한 변 (px)
  lum: Lum; // [0,1]² → [0,1] 밀도 (0=백지, 1=잉크)
  ink: string; // 마크 색 (톤 믹스 결과)
  params: Params;
  rng: () => number; // 분 단위 rng (minuteKey + ':effect')
};

export type EffectFn = (a: EffectArgs) => void;

export const effects: Record<EffectId, EffectFn> = {
  dots,
  dither,
  stipple,
  steps,
};
