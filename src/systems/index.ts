// SPEC §5 — SystemId → render 함수 레지스트리.
// 시스템 구현은 W2(subdivision)부터 하나씩 채운다.

import type { Params, SystemId } from '../params/types';

export type RenderArgs = {
  ctx: CanvasRenderingContext2D;
  size: number; // 정사각 한 변 (px)
  params: Params;
  rng: () => number; // 렌더용으로 새로 만든 rng (dateKey + ':render')
};

export type RenderFn = (a: RenderArgs) => void;

export const systems: Partial<Record<SystemId, RenderFn>> = {};

export function renderFnFor(id: SystemId): RenderFn {
  const fn = systems[id];
  if (!fn) throw new Error(`system not implemented yet: ${id}`);
  return fn;
}
