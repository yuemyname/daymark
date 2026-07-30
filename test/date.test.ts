import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffDays,
  isValidDateKey,
  msUntilNextMidnightKST,
  todayKey,
} from '../src/core/date';

describe('todayKey', () => {
  it('KST 기준 YYYY-MM-DD', () => {
    // 2026-07-30T00:00:00 KST = 2026-07-29T15:00:00 UTC
    expect(todayKey(new Date('2026-07-29T15:00:00Z'))).toBe('2026-07-30');
    // 그 1ms 전은 아직 29일
    expect(todayKey(new Date('2026-07-29T14:59:59.999Z'))).toBe('2026-07-29');
  });

  it('실행 환경 타임존과 무관하다 (UTC now를 넣어도 KST 날짜)', () => {
    expect(todayKey(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01');
  });

  it('윤일 경계', () => {
    expect(todayKey(new Date('2028-02-28T15:00:00Z'))).toBe('2028-02-29');
    expect(todayKey(new Date('2028-02-29T15:00:00Z'))).toBe('2028-03-01');
  });
});

describe('isValidDateKey', () => {
  it('형식과 실존 여부를 모두 본다', () => {
    expect(isValidDateKey('2026-07-30')).toBe(true);
    expect(isValidDateKey('2028-02-29')).toBe(true); // 윤일
    expect(isValidDateKey('2026-02-29')).toBe(false); // 평년
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('2026-7-30')).toBe(false);
    expect(isValidDateKey('20260730')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
  });
});

describe('addDays / diffDays', () => {
  it('월말·연말·윤일을 넘는다', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('diffDays는 addDays의 역', () => {
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364);
    expect(diffDays('2026-07-30', addDays('2026-07-30', 90))).toBe(90);
    expect(diffDays('2026-07-30', '2026-07-29')).toBe(-1);
  });
});

describe('msUntilNextMidnightKST', () => {
  it('KST 자정 직전에는 거의 0', () => {
    // 2026-07-30T23:59:59 KST = 2026-07-30T14:59:59 UTC
    expect(msUntilNextMidnightKST(new Date('2026-07-30T14:59:59Z'))).toBe(1000);
  });

  it('KST 자정 직후에는 거의 하루', () => {
    expect(msUntilNextMidnightKST(new Date('2026-07-30T15:00:01Z'))).toBe(
      24 * 60 * 60 * 1000 - 1000,
    );
  });

  it('항상 (0, 24h] 범위', () => {
    const samples = [
      '2026-07-30T00:00:00Z',
      '2026-12-31T14:59:00Z',
      '2028-02-28T20:00:00Z',
    ];
    for (const s of samples) {
      const ms = msUntilNextMidnightKST(new Date(s));
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    }
  });
});
