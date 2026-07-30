import { oklch } from 'culori';
import { describe, expect, it } from 'vitest';
import { addDays } from '../src/core/date';
import { enforceDeltaL, MIN_DELTA_L, paletteFor } from '../src/core/palette';
import { rngFor } from '../src/core/rng';

const HEX = /^#[0-9a-f]{6}$/;

function deltaL(a: string, b: string): number {
  const ca = oklch(a);
  const cb = oklch(b);
  if (!ca || !cb) throw new Error(`unparseable color: ${a} / ${b}`);
  return Math.abs((ca.l ?? 0) - (cb.l ?? 0));
}

describe('paletteFor', () => {
  it('같은 rng 시드 → 같은 팔레트', () => {
    const a = paletteFor(rngFor('2026-07-30:params'));
    const b = paletteFor(rngFor('2026-07-30:params'));
    expect(a).toEqual(b);
  });

  it('구조 — bg/accent hex, 잉크 3~5개', () => {
    for (let i = 0; i < 50; i++) {
      const p = paletteFor(rngFor(`seed-${i}`));
      expect(p.bg).toMatch(HEX);
      expect(p.accent).toMatch(HEX);
      expect(p.inks.length).toBeGreaterThanOrEqual(3);
      expect(p.inks.length).toBeLessThanOrEqual(5);
      for (const ink of p.inks) expect(ink).toMatch(HEX);
      expect(['dark', 'light', 'paper']).toContain(p.mode);
    }
  });

  it('ΔL 가드 — 365일 전부 모든 잉크가 배경 대비 ΔL ≥ 0.35', () => {
    // hex 변환에서 ±0.01 정도 양자화 오차가 생길 수 있어 그만큼만 허용
    const tolerance = 0.015;
    for (let i = 0; i < 365; i++) {
      const key = addDays('2026-01-01', i);
      const p = paletteFor(rngFor(key + ':params'));
      for (const ink of p.inks) {
        expect(
          deltaL(p.bg, ink),
          `${key} ink ${ink} on bg ${p.bg}`,
        ).toBeGreaterThanOrEqual(MIN_DELTA_L - tolerance);
      }
    }
  });

  it('accent는 잉크 중 하나', () => {
    for (let i = 0; i < 50; i++) {
      const p = paletteFor(rngFor(`accent-${i}`));
      expect(p.inks).toContain(p.accent);
    }
  });
});

describe('enforceDeltaL', () => {
  it('이미 충분히 벌어져 있으면 그대로', () => {
    expect(enforceDeltaL(0.8, 0.15)).toBe(0.8);
  });

  it('모자라면 최소 0.35까지 밀어낸다', () => {
    expect(Math.abs(enforceDeltaL(0.3, 0.15) - 0.15)).toBeGreaterThanOrEqual(MIN_DELTA_L);
    expect(Math.abs(enforceDeltaL(0.85, 0.95) - 0.95)).toBeGreaterThanOrEqual(MIN_DELTA_L);
  });
});
