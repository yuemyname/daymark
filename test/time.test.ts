import { describe, expect, it } from 'vitest';
import {
  addHours,
  addSeconds,
  hmsOf,
  hourKey,
  isValidTsKey,
  minuteKey,
  secondOf,
  tsKey,
} from '../src/core/time';

describe('tsKey', () => {
  it('KST 기준 YYYY-MM-DDTHH:mm:ss', () => {
    // 2026-07-30T14:23:07 KST = 2026-07-30T05:23:07 UTC
    expect(tsKey(new Date('2026-07-30T05:23:07Z'))).toBe('2026-07-30T14:23:07');
    // KST 자정 경계
    expect(tsKey(new Date('2026-07-29T14:59:59Z'))).toBe('2026-07-29T23:59:59');
    expect(tsKey(new Date('2026-07-29T15:00:00Z'))).toBe('2026-07-30T00:00:00');
  });

  it('연말·윤일 경계', () => {
    expect(tsKey(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01T00:00:00');
    expect(tsKey(new Date('2028-02-28T15:00:00Z'))).toBe('2028-02-29T00:00:00');
  });
});

describe('키 분해', () => {
  const ts = '2026-07-30T14:23:07';
  it('hourKey / minuteKey / secondOf / hmsOf', () => {
    expect(hourKey(ts)).toBe('2026-07-30T14');
    expect(minuteKey(ts)).toBe('2026-07-30T14:23');
    expect(secondOf(ts)).toBe(7);
    expect(hmsOf(ts)).toEqual({ h: 14, m: 23, s: 7 });
  });
});

describe('isValidTsKey', () => {
  it('형식·범위·실존 여부', () => {
    expect(isValidTsKey('2026-07-30T14:23:07')).toBe(true);
    expect(isValidTsKey('2028-02-29T00:00:00')).toBe(true); // 윤일
    expect(isValidTsKey('2026-02-29T00:00:00')).toBe(false); // 평년
    expect(isValidTsKey('2026-07-30T24:00:00')).toBe(false);
    expect(isValidTsKey('2026-07-30T14:60:00')).toBe(false);
    expect(isValidTsKey('2026-07-30 14:23:07')).toBe(false);
    expect(isValidTsKey('2026-07-30')).toBe(false);
  });
});

describe('addSeconds / addHours', () => {
  it('분·시·일·연 경계를 넘는다', () => {
    expect(addSeconds('2026-07-30T14:23:59', 1)).toBe('2026-07-30T14:24:00');
    expect(addSeconds('2026-07-30T23:59:59', 1)).toBe('2026-07-31T00:00:00');
    expect(addSeconds('2026-12-31T23:59:59', 1)).toBe('2027-01-01T00:00:00');
    expect(addSeconds('2026-07-30T00:00:00', -1)).toBe('2026-07-29T23:59:59');
  });

  it('addHours는 시 키를 다룬다', () => {
    expect(addHours('2026-07-30T14', -1)).toBe('2026-07-30T13');
    expect(addHours('2026-07-30T00', -1)).toBe('2026-07-29T23');
    expect(addHours('2027-01-01T00', -2)).toBe('2026-12-31T22');
  });
});
