// SPEC §5 — 필드: 회색조 밀도 원본을 만든다. 해상도는 항상 512 (§5).
//
// 구현 노트: SPEC은 오프스크린 캔버스 ctx를 그리지만, 여기서는 Float32 밀도
// 버퍼(0=백지, 1=잉크)를 직접 채운다. 캔버스 래스터화가 끼지 않아서
// 필드 값이 브라우저 간에도 비트 단위로 동일해지고(§2.5보다 강한 보장),
// getImageData 왕복이 없어 더 싸다. 전처리(tone)와 샘플러가 이 버퍼를 그대로 쓴다.

import type { FieldId, Params } from '../params/types';
import { noise } from './noise';
import { radial } from './radial';
import { interference } from './interference';
import { subdivision } from './subdivision';
import { flow } from './flow';

export const FIELD_RES = 512;

export type FieldArgs = {
  buf: Float32Array; // res×res 밀도 버퍼. 필드가 전체를 덮어쓴다
  res: number; // 항상 512
  params: Params;
  rng: () => number; // 분 단위 rng (minuteKey + ':field')
};

export type FieldFn = (a: FieldArgs) => void;

export const fields: Record<FieldId, FieldFn> = {
  noise,
  radial,
  interference,
  subdivision,
  flow,
};
