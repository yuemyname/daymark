import { describe, expect, it } from 'vitest';
import { addHours, addSeconds } from '../src/core/time';
import { paramsFor, pickFor } from '../src/params';
import { EFFECT_IDS, FIELD_IDS } from '../src/params/types';

describe('계층 시드 (SPEC §2.3)', () => {
  it('같은 ts → 깊은 동등', () => {
    expect(paramsFor('2026-07-30T14:23:07')).toEqual(paramsFor('2026-07-30T14:23:07'));
  });

  it('같은 분, 다른 초 → 구조는 같고 phase만 다르다', () => {
    const a = paramsFor('2026-07-30T14:23:07');
    const b = paramsFor('2026-07-30T14:23:41');
    expect(b.field).toBe(a.field);
    expect(b.effect).toBe(a.effect);
    expect(b.fieldConfig).toEqual(a.fieldConfig);
    expect(b.effectConfig).toEqual(a.effectConfig);
    expect(b.seedHex).toBe(a.seedHex);
    expect(a.phase).toBeCloseTo(7 / 60, 10);
    expect(b.phase).toBeCloseTo(41 / 60, 10);
  });

  it('같은 시, 다른 분 → 종류는 같고 config가 다르다', () => {
    const a = paramsFor('2026-07-30T14:23:00');
    const b = paramsFor('2026-07-30T14:47:00');
    expect(b.field).toBe(a.field);
    expect(b.effect).toBe(a.effect);
    expect(JSON.stringify(b.fieldConfig)).not.toBe(JSON.stringify(a.fieldConfig));
  });

  it('phase는 s/60', () => {
    expect(paramsFor('2026-07-30T14:23:00').phase).toBe(0);
    expect(paramsFor('2026-07-30T14:23:30').phase).toBe(0.5);
  });
});

describe('조합 선택 (SPEC §5.1)', () => {
  it('48시간에서 이펙트 장기 연속이 없다', () => {
    let streak = 1;
    let prev = pickFor('2026-07-01T00').effect;
    for (let i = 1; i < 48; i++) {
      const hk = addHours('2026-07-01T00', i);
      const cur = pickFor(hk).effect;
      streak = cur === prev ? streak + 1 : 1;
      expect(streak, `${hk} 에서 ${cur} ${streak}연속`).toBeLessThan(4);
      prev = cur;
    }
  });

  it('한 달치 시간대에서 이펙트 4종·필드 5종이 전부 등장한다', () => {
    const effects = new Set<string>();
    const fieldSet = new Set<string>();
    for (let i = 0; i < 24 * 30; i++) {
      const p = pickFor(addHours('2026-07-01T00', i));
      effects.add(p.effect);
      fieldSet.add(p.field);
    }
    expect([...effects].sort()).toEqual([...EFFECT_IDS].sort());
    expect([...fieldSet].sort()).toEqual([...FIELD_IDS].sort());
  });

  it('궁합 0.1짜리 조합(subdivision×dither)은 드물다', () => {
    let count = 0;
    let ditherCount = 0;
    for (let i = 0; i < 24 * 60; i++) {
      const p = pickFor(addHours('2026-01-01T00', i));
      if (p.effect === 'dither') {
        ditherCount++;
        if (p.field === 'subdivision') count++;
      }
    }
    expect(count / Math.max(1, ditherCount)).toBeLessThan(0.1);
  });
});

describe('paramsFor 검증', () => {
  it('잘못된 ts 거부', () => {
    expect(() => paramsFor('2026-07-30')).toThrow();
    expect(() => paramsFor('2026-07-30T24:00:00')).toThrow();
    expect(() => paramsFor('2026-02-30T12:00:00')).toThrow();
  });

  it('config.kind가 추첨 결과와 일치', () => {
    for (let i = 0; i < 24; i++) {
      const p = paramsFor(addSeconds('2026-07-01T00:00:00', i * 3600));
      expect(p.fieldConfig.kind).toBe(p.field);
      expect(p.effectConfig.kind).toBe(p.effect);
    }
  });
});
