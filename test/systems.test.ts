// 시스템 5종 공통 — 드로우 콜 결정성.
// (소수점 반올림 스냅샷을 뜨는 전체 L2는 W4.1에서. 여기선 동일성·해상도 독립만)

import { describe, expect, it } from 'vitest';
import { addMinutes } from '../src/core/date';
import { rngFor } from '../src/core/rng';
import { paramsFor } from '../src/params';
import { SYSTEM_IDS, type SystemId } from '../src/params/types';
import { systems } from '../src/systems';

function makeTraceCtx(): { ctx: CanvasRenderingContext2D; trace: string[] } {
  const trace: string[] = [];
  const fmt = (v: unknown): string => (typeof v === 'number' ? v.toFixed(4) : String(v));
  const ctx = new Proxy(
    {},
    {
      get(_t, k) {
        return (...args: unknown[]) => {
          trace.push(`${String(k)}(${args.map(fmt).join(',')})`);
        };
      },
      set(_t, k, v) {
        trace.push(`set ${String(k)}=${fmt(v)}`);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, trace };
}

/** 각 시스템이 걸리는 판 키를 하나씩 찾는다. */
function keyFor(system: SystemId): string {
  for (let i = 0; i < 600; i++) {
    const key = addMinutes('2026-03-01 00:00', i);
    if (paramsFor(key).system === system) return key;
  }
  throw new Error(`no key found for ${system}`);
}

function renderTrace(system: SystemId, key: string, size: number): string[] {
  const params = paramsFor(key);
  const fn = systems[system];
  if (!fn) throw new Error(`not implemented: ${system}`);
  const { ctx, trace } = makeTraceCtx();
  const gen = fn({ ctx, size, params, rng: rngFor(key + ':render') });
  let steps = 0;
  while (!gen.next().done) steps++;
  expect(steps, `${system}의 yield 수`).toBeGreaterThan(2);
  return trace;
}

describe.each(SYSTEM_IDS)('%s', (system) => {
  const key = keyFor(system);

  it('같은 키 → 드로우 콜 트레이스가 완전히 같다', () => {
    expect(renderTrace(system, key, 720)).toEqual(renderTrace(system, key, 720));
  });

  it('size가 달라도 트레이스가 같다 — 해상도 독립 (§8)', () => {
    const a = renderTrace(system, key, 720);
    const b = renderTrace(system, key, 4096);
    expect(a.length).toBe(b.length);
    const diff = a.filter((line, i) => line !== b[i]);
    expect(diff.length).toBe(1); // scale() 딱 하나
    expect(diff[0]).toContain('scale');
  });

  it('다른 키 → 다른 트레이스', () => {
    const other = addMinutes(key, 1440);
    const params = paramsFor(other);
    // 같은 시스템끼리 비교해야 의미가 있다 — 시스템이 다르면 자명하게 다르므로
    if (params.system !== system) return;
    expect(renderTrace(system, key, 720)).not.toEqual(renderTrace(system, other, 720));
  });
});
