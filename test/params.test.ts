import { describe, expect, it } from 'vitest';
import { addMinutes } from '../src/core/date';
import { paramsFor, systemFor } from '../src/params';
import { SYSTEM_IDS } from '../src/params/types';

describe('systemFor — 시스템 선택 규칙 (SPEC §5.1)', () => {
  it('같은 키 → 항상 같은 시스템', () => {
    expect(systemFor('2026-07-30 21:07')).toBe(systemFor('2026-07-30 21:07'));
  });

  it('연속 500분에서 같은 시스템의 장기 연속이 없다', () => {
    // 회피 집합이 직전 2분의 "원추첨"이라 3~4연속이 드물게 샐 수 있다 (params/index.ts 참고).
    // 여기서는 3연속이 희귀하고, 4연속이 극히 희귀하고, 5연속이 없는 것을 확인한다.
    let streak = 1;
    let tripleCount = 0;
    let quadCount = 0;
    let prev = systemFor('2026-07-30 00:00');
    for (let i = 1; i < 500; i++) {
      const key = addMinutes('2026-07-30 00:00', i);
      const sys = systemFor(key);
      streak = sys === prev ? streak + 1 : 1;
      expect(streak, `${key} 에서 ${sys} ${streak}연속`).toBeLessThan(5);
      if (streak === 3) tripleCount++;
      if (streak === 4) quadCount++;
      prev = sys;
    }
    expect(tripleCount).toBeLessThan(25);
    expect(quadCount).toBeLessThanOrEqual(3);
  });

  it('연속 300분에서 5종이 전부 등장한다', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      seen.add(systemFor(addMinutes('2026-01-01 00:00', i)));
    }
    expect([...seen].sort()).toEqual([...SYSTEM_IDS].sort());
  });
});

describe('paramsFor', () => {
  it('같은 키 → 깊은 동등', () => {
    expect(paramsFor('2026-07-30 21:07')).toEqual(paramsFor('2026-07-30 21:07'));
  });

  it('config.kind가 system과 일치한다', () => {
    for (let i = 0; i < 60; i++) {
      const p = paramsFor(addMinutes('2026-01-01 00:00', i * 7));
      expect(p.config.kind).toBe(p.system);
    }
  });

  it('잘못된 키는 거부 (분 없는 날짜 키 포함)', () => {
    expect(() => paramsFor('2026-07-30')).toThrow();
    expect(() => paramsFor('2026-07-30 24:00')).toThrow();
    expect(() => paramsFor('2026-02-30 12:00')).toThrow();
    expect(() => paramsFor('2026-7-30 12:0')).toThrow();
  });
});
