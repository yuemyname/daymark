import { describe, expect, it } from 'vitest';
import { cyrb128, rngFor, seedHexFor, sfc32 } from '../src/core/rng';

describe('cyrb128', () => {
  it('같은 입력 → 같은 해시', () => {
    expect(cyrb128('2026-07-30')).toEqual(cyrb128('2026-07-30'));
  });

  it('입력이 다르면 해시가 다르다', () => {
    expect(cyrb128('2026-07-30')).not.toEqual(cyrb128('2026-07-31'));
    expect(cyrb128('2026-07-30:params')).not.toEqual(cyrb128('2026-07-30:render'));
  });

  it('결과는 부호 없는 32bit 정수 4개', () => {
    for (const h of cyrb128('daymark')) {
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('sfc32', () => {
  it('같은 시드 → 비트 단위로 같은 수열 (W0.1의 런타임 불변 가정)', () => {
    const a = sfc32(...cyrb128('2026-07-30'));
    const b = sfc32(...cyrb128('2026-07-30'));
    for (let i = 0; i < 1000; i++) {
      expect(a()).toBe(b());
    }
  });

  it('[0, 1) 범위', () => {
    const rng = rngFor('2026-07-30');
    for (let i = 0; i < 10000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('수열 고정값 스냅샷 — 구현이 바뀌면 모든 그림이 바뀐다', () => {
    const rng = rngFor('2026-07-30');
    const seq = Array.from({ length: 8 }, () => rng());
    expect(seq).toMatchSnapshot();
  });
});

describe('seedHexFor', () => {
  it('6자리 hex', () => {
    expect(seedHexFor('2026-07-30')).toMatch(/^[0-9a-f]{6}$/);
  });

  it('날짜마다 다르다', () => {
    expect(seedHexFor('2026-07-30')).not.toBe(seedHexFor('2026-07-31'));
  });
});
