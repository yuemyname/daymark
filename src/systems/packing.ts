// S2 packing — 원 채우기 (SPEC §6).
// 후보 위치를 뽑아 충돌 직전까지 반지름을 키운다.
// 충돌 검사는 공간 격자(cell = maxR×2) — 전수 비교는 원 2,000개에서 버벅인다.
//
// mask 'dateGlyph': 그날의 일(日) 숫자 글리프 내부에만 원을 채운다.
// 오프스크린 캔버스에 숫자를 그린 뒤 알파값으로 판정한다.
// 폰트 래스터화는 브라우저마다 미세하게 달라 §2.4의 "픽셀 비허용" 경계에 든다.

import { enterUnitSpace, exitUnitSpace } from '../core/canvas';
import { dayOf } from '../core/date';
import type { RenderArgs } from './index';

type Circle = { x: number; y: number; r: number };

const ATTEMPTS_PER_STEP = 120;
const MASK_RES = 256;

export function* packing(a: RenderArgs): Generator<void, void, void> {
  const { ctx, size, params, rng } = a;
  const cfg = params.config;
  if (cfg.kind !== 'packing') throw new Error(`wrong config: ${cfg.kind}`);
  const inks = params.palette.inks;

  enterUnitSpace(ctx, size);
  ctx.fillStyle = params.palette.bg;
  ctx.fillRect(0, 0, 1, 1);
  yield;

  const mask =
    cfg.mask === 'dateGlyph' ? buildGlyphMask(dayOf(params.dateKey)) : null;

  // 공간 격자
  const cell = cfg.maxR * 2;
  const gridN = Math.ceil(1 / cell);
  const grid = new Map<number, Circle[]>();
  const cellKey = (cx: number, cy: number): number => cy * gridN + cx;

  const neighbors = (x: number, y: number): Circle[] => {
    const cx = Math.min(gridN - 1, Math.max(0, Math.floor(x / cell)));
    const cy = Math.min(gridN - 1, Math.max(0, Math.floor(y / cell)));
    const out: Circle[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = grid.get(cellKey(cx + dx, cy + dy));
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  };

  for (let i = 0; i < cfg.attempts; i++) {
    const x = rng();
    const y = rng();
    // 스타일 추첨은 배치 성공 여부와 무관하게 소비 — rng 흐름을 단순하게 유지
    const styleRoll = rng();
    const inkIdx = Math.floor(rng() * inks.length);

    if (mask && !mask(x, y)) {
      if (i % ATTEMPTS_PER_STEP === ATTEMPTS_PER_STEP - 1) yield;
      continue;
    }

    // 이웃과의 거리로 최대 반지름 결정
    let rMax = cfg.maxR;
    for (const c of neighbors(x, y)) {
      const d = Math.hypot(x - c.x, y - c.y) - c.r - cfg.padding;
      if (d < rMax) rMax = d;
    }
    // 캔버스 밖으로 나가지 않게
    rMax = Math.min(rMax, x, y, 1 - x, 1 - y);
    // 마스크 모드에선 글리프 경계 밖으로 덜 삐져나가게 반지름을 죈다
    if (mask) rMax = Math.min(rMax, cfg.maxR * 0.6);

    if (rMax < cfg.minR) {
      if (i % ATTEMPTS_PER_STEP === ATTEMPTS_PER_STEP - 1) yield;
      continue;
    }

    const circle: Circle = { x, y, r: rMax };
    const cx = Math.min(gridN - 1, Math.floor(x / cell));
    const cy = Math.min(gridN - 1, Math.floor(y / cell));
    const key = cellKey(cx, cy);
    const bucket = grid.get(key);
    if (bucket) bucket.push(circle);
    else grid.set(key, [circle]);

    const ink = inks[inkIdx];
    if (ink === undefined) throw new Error('empty palette');
    drawCircle(ctx, circle, cfg.style, styleRoll, ink);

    if (i % ATTEMPTS_PER_STEP === ATTEMPTS_PER_STEP - 1) yield;
  }

  exitUnitSpace(ctx);
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  c: Circle,
  style: 'solid' | 'ring' | 'nested' | 'mixed',
  styleRoll: number,
  ink: string,
): void {
  const resolved =
    style === 'mixed' ? (styleRoll < 0.4 ? 'solid' : styleRoll < 0.8 ? 'ring' : 'nested') : style;

  switch (resolved) {
    case 'solid':
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'ring':
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(0.0012, c.r * 0.18);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.88, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case 'nested': {
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(0.001, c.r * 0.1);
      for (let r = c.r * 0.85; r > c.r * 0.15; r -= c.r * 0.3) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }
  }
}

/**
 * 일(日) 숫자 글리프 마스크. (x, y) ∈ [0,1]² → 글리프 내부 여부.
 * DOM이 없는 환경(테스트)에서는 null — 호출부에서 mask 없음으로 처리된다.
 */
function buildGlyphMask(dateKey: string): ((x: number, y: number) => boolean) | null {
  if (typeof document === 'undefined') return null;
  const day = String(Number(dateKey.slice(8, 10))); // "05" → "5"

  const canvas = document.createElement('canvas');
  canvas.width = MASK_RES;
  canvas.height = MASK_RES;
  const mctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!mctx) return null;

  mctx.fillStyle = '#000';
  mctx.textAlign = 'center';
  mctx.textBaseline = 'middle';
  mctx.font = `900 ${day.length > 1 ? MASK_RES * 0.78 : MASK_RES * 0.95}px system-ui, sans-serif`;
  mctx.fillText(day, MASK_RES / 2, MASK_RES * 0.54);

  const alpha = mctx.getImageData(0, 0, MASK_RES, MASK_RES).data;
  return (x, y) => {
    const px = Math.min(MASK_RES - 1, Math.max(0, Math.floor(x * MASK_RES)));
    const py = Math.min(MASK_RES - 1, Math.max(0, Math.floor(y * MASK_RES)));
    return (alpha[(py * MASK_RES + px) * 4 + 3] ?? 0) > 128;
  };
}
