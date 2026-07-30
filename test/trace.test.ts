// W4.1 / SPEC §10 L2 — 드로우 콜 트레이스 스냅샷.
// 5종 각각의 트레이스 해시를 기록해두고, 렌더러 리팩터링이
// 결과 그림을 바꿨는지 브라우저 없이 잡아낸다.
//
// 깨졌다면: 의도한 렌더 변경이면 스냅샷 갱신(= 그림이 바뀌는 배포임을 인지),
// 아니면 리팩터링이 그림을 바꿔먹은 것이다.

import { describe, expect, it } from 'vitest';
import { addMinutes } from '../src/core/date';
import { cyrb128, rngFor } from '../src/core/rng';
import { paramsFor } from '../src/params';
import { SYSTEM_IDS, type SystemId } from '../src/params/types';
import { systems } from '../src/systems';
import { makeTraceCtx } from './helpers/traceCtx';

function keyFor(system: SystemId): string {
  for (let i = 0; i < 600; i++) {
    const key = addMinutes('2026-03-01 00:00', i);
    if (paramsFor(key).system === system) return key;
  }
  throw new Error(`no key found for ${system}`);
}

function traceHash(system: SystemId, key: string): string {
  const fn = systems[system];
  if (!fn) throw new Error(`not implemented: ${system}`);
  const { ctx, trace } = makeTraceCtx();
  const gen = fn({ ctx, size: 720, params: paramsFor(key), rng: rngFor(key + ':render') });
  while (!gen.next().done) {
    /* drain */
  }
  return cyrb128(trace.join('\n'))
    .map((h) => h.toString(16).padStart(8, '0'))
    .join('');
}

describe('L2 — 드로우 콜 트레이스 스냅샷', () => {
  it('시스템 5종의 트레이스 해시가 기록과 일치한다', () => {
    const record: Record<string, { key: string; hash: string }> = {};
    for (const system of SYSTEM_IDS) {
      const key = keyFor(system);
      record[system] = { key, hash: traceHash(system, key) };
    }
    expect(record).toMatchSnapshot();
  });
});
