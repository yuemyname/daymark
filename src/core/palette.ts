// SPEC §7 — 팔레트는 OKLCH에서 뽑는다.
// 명도(L)가 지각적으로 균일해서 어떤 색조를 뽑아도 대비가 유지된다.
// 색역 밖 색은 culori의 clampChroma로 채도만 줄여서 sRGB 안으로 넣는다 (L·H 보존).

import { clampChroma, formatHex } from 'culori';

export type PaletteMode = 'dark' | 'light' | 'paper';

export type Palette = {
  bg: string;
  inks: string[]; // 3~5개
  accent: string; // UI 크롬에도 쓰인다 (§9)
  mode: PaletteMode;
};

/** 모든 잉크는 배경과 ΔL ≥ 0.35. 이 가드가 없으면 한 달에 두세 번 안 보이는 그림이 나온다. */
export const MIN_DELTA_L = 0.35;

type OklchInk = { l: number; c: number; h: number };

function toHex(l: number, c: number, h: number): string {
  const clamped = clampChroma({ mode: 'oklch', l, c, h }, 'oklch');
  return formatHex(clamped);
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  const v = arr[Math.floor(rng() * arr.length)];
  if (v === undefined) throw new Error('pick from empty array');
  return v;
}

function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

const SCHEMES = ['analogous', 'split-complementary', 'triad', 'mono'] as const;
type Scheme = (typeof SCHEMES)[number];

function schemeHues(scheme: Scheme, h0: number): number[] {
  switch (scheme) {
    case 'analogous':
      return [h0 - 30, h0, h0 + 30];
    case 'split-complementary':
      return [h0, h0 + 150, h0 - 150];
    case 'triad':
      return [h0, h0 + 120, h0 - 120];
    case 'mono':
      return [h0 - 8, h0, h0 + 8];
  }
}

function norm360(h: number): number {
  return ((h % 360) + 360) % 360;
}

/** ΔL 가드 — 배경에서 MIN_DELTA_L 이상 벌어지도록 L을 밀어낸다. */
export function enforceDeltaL(inkL: number, bgL: number): number {
  if (Math.abs(inkL - bgL) >= MIN_DELTA_L) return inkL;
  // 잉크가 원래 향하던 방향으로 밀어낸다. 공간이 없으면 반대쪽으로.
  const dir = inkL >= bgL ? 1 : -1;
  let pushed = bgL + dir * MIN_DELTA_L;
  if (pushed < 0.05 || pushed > 0.98) pushed = bgL - dir * MIN_DELTA_L;
  return Math.min(0.98, Math.max(0.05, pushed));
}

export function paletteFor(rng: () => number): Palette {
  // 1. mode 추첨 — dark 40% / paper 40% / light 20%
  const r = rng();
  const mode: PaletteMode = r < 0.4 ? 'dark' : r < 0.8 ? 'paper' : 'light';

  // 2. 기저 색조
  const h0 = rng() * 360;

  // 3. 배색 방식
  const scheme = pick(rng, SCHEMES);
  const hues = schemeHues(scheme, h0);

  // 5. bg는 아주 낮은 채도(C < 0.02). 배경이 채도를 가지면 잉크가 다 탁해 보인다.
  const bgL =
    mode === 'dark'
      ? range(rng, 0.12, 0.19)
      : mode === 'paper'
        ? range(rng, 0.92, 0.96)
        : range(rng, 0.965, 0.985);
  const bgC = range(rng, 0.004, 0.018);
  const bgH = norm360(h0 + range(rng, -20, 20));

  // 4. 잉크 3~5개
  const inkCount = 3 + Math.floor(rng() * 3);
  const inks: OklchInk[] = [];
  for (let i = 0; i < inkCount; i++) {
    const h = norm360(pick(rng, hues) + range(rng, -6, 6));
    const c = range(rng, 0.08, 0.2);
    const rawL = mode === 'dark' ? range(rng, 0.6, 0.88) : range(rng, 0.22, 0.55);
    inks.push({ l: enforceDeltaL(rawL, bgL), c, h });
  }

  // 6. accent는 잉크 중 C가 가장 높은 것
  let accentIdx = 0;
  for (let i = 1; i < inks.length; i++) {
    const cur = inks[i];
    const best = inks[accentIdx];
    if (cur && best && cur.c > best.c) accentIdx = i;
  }
  const accentInk = inks[accentIdx];
  if (!accentInk) throw new Error('unreachable: no inks');

  return {
    bg: toHex(bgL, bgC, bgH),
    inks: inks.map((i) => toHex(i.l, i.c, i.h)),
    accent: toHex(accentInk.l, accentInk.c, accentInk.h),
    mode,
  };
}
