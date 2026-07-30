// SPEC §8 — 톤. 색이 없으므로 팔레트 대신 전처리 체인 + 잉크 모드.
//
// 모드는 추첨하지 않는다 — 시각의 함수다:
//   06:00~17:59 paper (흰 배경 검은 잉크) / 18:00~05:59 ink (반대)
//   경계에서 8분간 크로스페이드.
//
// 전처리 체인 (tooooools Image Preprocessing 순서 그대로):
//   blur → grain → gamma → black/white point
// 밀도 가드: 전처리 후 평균 밀도가 0.30~0.55 밖이면 자동 보정.
// 이게 구 스펙의 ΔL 가드를 대신한다 — 없으면 하루에 몇 번씩 새까맣거나
// 텅 빈 화면이 나오고, 그 위의 시계 바늘이 안 보인다.

export type ToneMode = 'paper' | 'ink';

export type Tone = {
  mode: ToneMode;
  blur: number; // 0 ~ 0.02 (유닛)
  grain: number; // 0 ~ 0.15
  gamma: number; // 0.5 ~ 2.2
  blackPoint: number; // 0 ~ 0.35
  whitePoint: number; // 0.65 ~ 1
};

export const DENSITY_MIN = 0.3;
export const DENSITY_MAX = 0.55;

const FADE_MIN = 8; // 경계 크로스페이드 (분)

export function modeFor(ts: string): ToneMode {
  const h = +ts.slice(11, 13);
  return h >= 6 && h < 18 ? 'paper' : 'ink';
}

/** 0 = 완전 paper, 1 = 완전 ink. 06:00·18:00 경계에서 8분 램프. */
export function modeMixFor(ts: string): number {
  const h = +ts.slice(11, 13);
  const m = +ts.slice(14, 16);
  const s = +ts.slice(17, 19);
  const t = h * 60 + m + s / 60; // 하루 내 분 단위 위치
  if (t >= 360 && t < 360 + FADE_MIN) return 1 - (t - 360) / FADE_MIN; // ink → paper
  if (t >= 1080 && t < 1080 + FADE_MIN) return (t - 1080) / FADE_MIN; // paper → ink
  return t >= 360 && t < 1080 ? 0 : 1;
}

/** 톤 파라미터 추첨 (mode 제외 — mode는 시각의 함수). */
export function toneFor(ts: string, rng: () => number): Tone {
  const r = (min: number, max: number): number =>
    Math.round((min + rng() * (max - min)) * 10000) / 10000;
  return {
    mode: modeFor(ts),
    blur: r(0, 0.015),
    grain: r(0, 0.12),
    gamma: r(0.7, 1.6),
    blackPoint: r(0, 0.2),
    whitePoint: r(0.8, 1),
  };
}

export function meanDensity(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] ?? 0;
  return sum / buf.length;
}

/**
 * 전처리 체인을 밀도 버퍼(0=백지, 1=완전 잉크)에 제자리 적용한다.
 * grain은 주입된 rng 수열로 — 픽셀 순회 순서가 곧 수열 순서라 결정적이다.
 */
export function applyTone(
  buf: Float32Array,
  res: number,
  tone: Tone,
  grainRng: () => number,
): void {
  // 1. blur — 유닛 반지름을 픽셀로. 1px 미만이면 생략
  const radius = Math.round(tone.blur * res);
  if (radius >= 1) boxBlur(buf, res, radius);

  // 2. grain → 3. gamma → 4. black/white point
  const range = Math.max(0.05, tone.whitePoint - tone.blackPoint);
  for (let i = 0; i < buf.length; i++) {
    let v = buf[i] ?? 0;
    if (tone.grain > 0) v += (grainRng() - 0.5) * tone.grain;
    v = Math.min(1, Math.max(0, v));
    v = Math.pow(v, tone.gamma);
    v = (v - tone.blackPoint) / range;
    buf[i] = Math.min(1, Math.max(0, v));
  }

  // 5. 밀도 가드 — 평균이 [0.30, 0.55] 밖이면 선형 스케일로 안으로 끌어온다
  const mean = meanDensity(buf);
  if (mean > 1e-6 && (mean < DENSITY_MIN || mean > DENSITY_MAX)) {
    const target = mean < DENSITY_MIN ? DENSITY_MIN : DENSITY_MAX;
    const k = target / mean;
    for (let i = 0; i < buf.length; i++) {
      buf[i] = Math.min(1, (buf[i] ?? 0) * k);
    }
  }
}

function boxBlur(buf: Float32Array, res: number, radius: number): void {
  const tmp = new Float32Array(buf.length);
  const w = radius * 2 + 1;
  // 수평
  for (let y = 0; y < res; y++) {
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += buf[y * res + clampI(x, res)] ?? 0;
    for (let x = 0; x < res; x++) {
      tmp[y * res + x] = acc / w;
      acc -= buf[y * res + clampI(x - radius, res)] ?? 0;
      acc += buf[y * res + clampI(x + radius + 1, res)] ?? 0;
    }
  }
  // 수직
  for (let x = 0; x < res; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) acc += tmp[clampI(y, res) * res + x] ?? 0;
    for (let y = 0; y < res; y++) {
      buf[y * res + x] = acc / w;
      acc -= tmp[clampI(y - radius, res) * res + x] ?? 0;
      acc += tmp[clampI(y + radius + 1, res) * res + x] ?? 0;
    }
  }
}

function clampI(i: number, n: number): number {
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}
