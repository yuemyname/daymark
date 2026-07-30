import { describe, expect, it } from 'vitest';
import { addDays } from '../src/core/date';
import { paramsFor, systemFor } from '../src/params';
import { SYSTEM_IDS } from '../src/params/types';

describe('systemFor — 시스템 선택 규칙 (SPEC §5.1)', () => {
  it('같은 날짜 → 항상 같은 시스템', () => {
    expect(systemFor('2026-07-30')).toBe(systemFor('2026-07-30'));
  });

  it('1년치에서 같은 시스템이 3일 연속으로 나오지 않는다', () => {
    let streak = 1;
    let prev = systemFor('2026-01-01');
    for (let i = 1; i < 365; i++) {
      const sys = systemFor(addDays('2026-01-01', i));
      streak = sys === prev ? streak + 1 : 1;
      expect(streak, `${addDays('2026-01-01', i)} 에서 ${sys} ${streak}연속`).toBeLessThan(3);
      prev = sys;
    }
  });

  it('1년치에서 5종이 전부 등장한다', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 365; i++) {
      seen.add(systemFor(addDays('2026-01-01', i)));
    }
    expect([...seen].sort()).toEqual([...SYSTEM_IDS].sort());
  });
});

describe('paramsFor', () => {
  it('같은 날짜 → 깊은 동등', () => {
    expect(paramsFor('2026-07-30')).toEqual(paramsFor('2026-07-30'));
  });

  it('config.kind가 system과 일치한다', () => {
    for (let i = 0; i < 60; i++) {
      const p = paramsFor(addDays('2026-01-01', i));
      expect(p.config.kind).toBe(p.system);
    }
  });

  it('잘못된 dateKey는 거부', () => {
    expect(() => paramsFor('2026-2-3')).toThrow();
    expect(() => paramsFor('2026-02-30')).toThrow();
  });
});
