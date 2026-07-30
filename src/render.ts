// 렌더 파이프라인 — ts 하나로 배경 한 장을 그린다.
// params → 필드(512 버퍼) → 톤 전처리 → 이중선형 샘플러 → 이펙트.
// 버퍼는 한 번 만들어 재사용한다 (§13 — 초당 재할당은 GC 스파이크를 만든다).

import { rngFor } from './core/rng';
import { bilinearSampler } from './core/sampler';
import { minuteKey } from './core/time';
import { applyTone, modeMixFor } from './core/tone';
import { FIELD_RES, fields } from './fields';
import { effects } from './effects';
import { paramsFor } from './params';
import type { Params } from './params/types';

// 재사용 버퍼 (§13)
const fieldBuf = new Float32Array(FIELD_RES * FIELD_RES);

/** 톤 믹스(0=paper, 1=ink) → 배경/잉크 회색. 크로스페이드 중엔 중간 회색을 지난다. */
export function colorsFor(ts: string): { bg: string; fg: string } {
  const mix = modeMixFor(ts);
  const bgV = Math.round((1 - mix) * 255);
  const fgV = Math.round(mix * 255);
  return { bg: `rgb(${bgV},${bgV},${bgV})`, fg: `rgb(${fgV},${fgV},${fgV})` };
}

export type RenderResult = { params: Params; bg: string; fg: string };

/**
 * ts의 배경을 ctx(size×size)에 그린다.
 * circleClip이면 원형 클립 안에만 — 원 밖은 bg로 남는다.
 */
export function renderBackground(
  ctx: CanvasRenderingContext2D,
  size: number,
  ts: string,
  opts: { circleClip?: boolean } = {},
): RenderResult {
  const params = paramsFor(ts);
  const mk = minuteKey(ts);
  const { bg, fg } = colorsFor(ts);

  // 1. 필드 — 분 단위 rng
  fields[params.field]({
    buf: fieldBuf,
    res: FIELD_RES,
    params,
    rng: rngFor(mk + ':field'),
  });

  // 2. 톤 전처리 + 밀도 가드
  applyTone(fieldBuf, FIELD_RES, params.tone, rngFor(mk + ':grain'));

  // 3. 이펙트
  const lum = bilinearSampler(fieldBuf, FIELD_RES);

  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  if (opts.circleClip) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.48, 0, Math.PI * 2);
    ctx.clip();
  }
  effects[params.effect]({
    ctx,
    size,
    lum,
    ink: fg,
    params,
    rng: rngFor(mk + ':effect'),
  });
  ctx.restore();

  return { params, bg, fg };
}
