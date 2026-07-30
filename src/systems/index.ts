// SPEC §5 — SystemId → render 함수 레지스트리.
// 시스템 구현은 W2(subdivision)부터 하나씩 채운다.

import { configFor } from '../params';
import type { Params, SystemId } from '../params/types';
import { rngFor } from '../core/rng';
import { flowfield } from './flowfield';
import { interference } from './interference';
import { packing } from './packing';
import { subdivision } from './subdivision';
import { truchet } from './truchet';

export type RenderArgs = {
  ctx: CanvasRenderingContext2D;
  size: number; // 정사각 한 변 (px)
  params: Params;
  rng: () => number; // 렌더용으로 새로 만든 rng (dateKey + ':render')
};

/**
 * 렌더는 제너레이터다 — yield 지점이 점진 렌더(§9.2)의 청크 경계가 된다.
 * 호출자가 한 번에 몇 스텝을 돌릴지 결정한다:
 *   화면은 rAF로 프레임당 몇 스텝, 썸네일·내보내기는 끝까지 drain.
 * yield 지점은 결정성에 영향을 주지 않는다 — 그리기 순서와 rng 소비는 동일하다.
 */
export type RenderFn = (a: RenderArgs) => Generator<void, void, void>;

export const systems: Partial<Record<SystemId, RenderFn>> = {
  flowfield,
  packing,
  truchet,
  subdivision,
  interference,
};

/**
 * 미구현 시스템은 subdivision으로 폴백한다 (W3에서 채워질 때까지의 임시 동작).
 * 반환된 id가 실제로 쓰인 렌더러다 — 캡션은 이걸 표시해야 거짓말이 안 된다.
 * params(L1 스냅샷)는 건드리지 않으므로, W3에서 진짜 시스템이 붙는 순간
 * 해당 날짜는 자동으로 제 그림을 되찾는다.
 */
export function resolveRender(id: SystemId): { id: SystemId; fn: RenderFn } {
  const fn = systems[id];
  if (fn) return { id, fn };
  return { id: 'subdivision', fn: subdivision };
}

/**
 * 뷰·내보내기 공용 — 렌더 함수와, 폴백 시 그에 맞게 재생성한 params를 돌려준다.
 * (5종이 모두 구현된 지금은 사실상 항상 원본 그대로다)
 */
export function renderPlanFor(
  key: string,
  params: Params,
): { id: SystemId; fn: RenderFn; params: Params } {
  const { id, fn } = resolveRender(params.system);
  if (id === params.system) return { id, fn, params };
  return {
    id,
    fn,
    params: { ...params, system: id, config: configFor(id, rngFor(key + ':params:fallback')) },
  };
}
