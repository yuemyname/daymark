import { describe, expect, it } from 'vitest';
import { rngFor } from '../src/core/rng';
import {
  applyTone,
  DENSITY_MAX,
  DENSITY_MIN,
  meanDensity,
  modeFor,
  modeMixFor,
  toneFor,
  type Tone,
} from '../src/core/tone';

const FLAT_TONE: Tone = {
  mode: 'paper',
  blur: 0,
  grain: 0,
  gamma: 1,
  blackPoint: 0,
  whitePoint: 1,
};

describe('modeFor — 시각의 함수, 추첨 아님 (§8)', () => {
  it('06:00~17:59 paper / 18:00~05:59 ink', () => {
    expect(modeFor('2026-07-30T05:59:59')).toBe('ink');
    expect(modeFor('2026-07-30T06:00:00')).toBe('paper');
    expect(modeFor('2026-07-30T17:59:59')).toBe('paper');
    expect(modeFor('2026-07-30T18:00:00')).toBe('ink');
    expect(modeFor('2026-07-30T03:00:00')).toBe('ink'); // 새벽 3시에 흰 화면 금지
  });
});

describe('modeMixFor — 8분 크로스페이드', () => {
  it('경계에서 램프', () => {
    expect(modeMixFor('2026-07-30T05:59:59')).toBeCloseTo(1, 1);
    expect(modeMixFor('2026-07-30T06:04:00')).toBeCloseTo(0.5, 5);
    expect(modeMixFor('2026-07-30T06:08:00')).toBe(0);
    expect(modeMixFor('2026-07-30T12:00:00')).toBe(0);
    expect(modeMixFor('2026-07-30T18:04:00')).toBeCloseTo(0.5, 5);
    expect(modeMixFor('2026-07-30T23:00:00')).toBe(1);
  });
});

describe('toneFor', () => {
  it('같은 rng 시드 → 같은 톤', () => {
    const a = toneFor('2026-07-30T14:23:07', rngFor('t:config'));
    const b = toneFor('2026-07-30T14:23:07', rngFor('t:config'));
    expect(a).toEqual(b);
  });
});

describe('applyTone — 밀도 가드 (§8)', () => {
  it('너무 어두운 필드를 0.55 이하로 끌어내린다', () => {
    const buf = new Float32Array(64 * 64).fill(0.92);
    applyTone(buf, 64, FLAT_TONE, rngFor('g'));
    expect(meanDensity(buf)).toBeLessThanOrEqual(DENSITY_MAX + 0.01);
  });

  it('너무 빈 필드를 0.30 이상으로 끌어올린다', () => {
    const buf = new Float32Array(64 * 64).fill(0.04);
    applyTone(buf, 64, FLAT_TONE, rngFor('g'));
    expect(meanDensity(buf)).toBeGreaterThanOrEqual(DENSITY_MIN - 0.01);
  });

  it('정상 범위 필드는 크게 건드리지 않는다', () => {
    const buf = new Float32Array(64 * 64);
    for (let i = 0; i < buf.length; i++) buf[i] = (i % 64) / 64; // 평균 ≈ 0.49
    applyTone(buf, 64, FLAT_TONE, rngFor('g'));
    const m = meanDensity(buf);
    expect(m).toBeGreaterThanOrEqual(DENSITY_MIN);
    expect(m).toBeLessThanOrEqual(DENSITY_MAX + 0.01);
  });

  it('같은 입력 → 같은 출력 (grain 포함)', () => {
    const tone: Tone = { ...FLAT_TONE, grain: 0.1, gamma: 1.2, blur: 0.01 };
    const a = new Float32Array(64 * 64).fill(0.5);
    const b = new Float32Array(64 * 64).fill(0.5);
    applyTone(a, 64, tone, rngFor('grain-seed'));
    applyTone(b, 64, tone, rngFor('grain-seed'));
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
