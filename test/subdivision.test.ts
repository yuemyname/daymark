// S4 subdivision의 드로우 콜 결정성 확인.
// (전 시스템 공통의 L2 트레이스 스냅샷은 W4.1에서 붙는다 — 여기선 동일성만 본다)

import { describe, expect, it } from 'vitest';
import { addDays } from '../src/core/date';
import { rngFor } from '../src/core/rng';
import { paramsFor } from '../src/params';
import { subdivision } from '../src/systems/subdivision';

/** 메서드 호출과 프로퍼티 대입을 전부 기록하는 가짜 2D 컨텍스트. */
function makeTraceCtx(): { ctx: CanvasRenderingContext2D; trace: string[] } {
  const trace: string[] = [];
  const fmt = (v: unknown): string =>
    typeof v === 'number' ? v.toFixed(4) : String(v);
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

// subdivision이 걸리는 날짜를 찾아 쓴다 (시스템 추첨은 날짜마다 다르므로)
function subdivisionDate(): string {
  for (let i = 0; i < 60; i++) {
    const key = addDays('2026-01-01', i);
    if (paramsFor(key).system === 'subdivision') return key;
  }
  throw new Error('no subdivision date in range');
}

function renderTrace(dateKey: string, size: number): string[] {
  const params = paramsFor(dateKey);
  if (params.config.kind !== 'subdivision') throw new Error('config mismatch');
  const { ctx, trace } = makeTraceCtx();
  const gen = subdivision({ ctx, size, params, rng: rngFor(dateKey + ':render') });
  let steps = 0;
  while (!gen.next().done) steps++;
  expect(steps).toBeGreaterThan(4); // 점진 렌더가 의미 있으려면 yield가 여러 번
  return trace;
}

describe('S4 subdivision', () => {
  const date = subdivisionDate();

  it('같은 날짜 → 드로우 콜 트레이스가 완전히 같다', () => {
    expect(renderTrace(date, 720)).toEqual(renderTrace(date, 720));
  });

  it('size가 달라도 트레이스가 같다 — 해상도 독립 (§8)', () => {
    // 유닛 좌표라 scale(size,size) 한 줄만 다르다
    const a = renderTrace(date, 720);
    const b = renderTrace(date, 4096);
    expect(a.length).toBe(b.length);
    const diff = a.filter((line, i) => line !== b[i]);
    expect(diff.length).toBe(1); // scale() 딱 하나
    expect(diff[0]).toContain('scale');
  });

  it('배경을 제일 먼저 깐다', () => {
    const t = renderTrace(date, 720);
    expect(t[0]).toContain('save');
    expect(t.slice(0, 4).join(' ')).toContain('fillRect');
  });
});
