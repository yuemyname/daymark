// SPEC §11.2 — `/` 지금.
// v1.2: 배경이 1Hz로 뚝뚝 끊기지 않는다. phase를 초의 연속값(s + frac)으로
// 넣고, 렌더 비용에 맞춰 프레임 간격을 스스로 조절하는 rAF 루프로 그린다
// (렌더가 한 프레임의 1/4만 차지하도록 — iPad에서도 발열 없이 흐른다).
// rng 재추첨은 여전히 분까지만 (§2.3) — 구조는 분 단위로만 바뀐다.
//
// document.hidden이면 rAF가 서므로 틱도 같이 선다 (§13).

import { setupSquareCanvas } from '../core/canvas';
import { nowParts } from '../core/clock';
import { minuteKey } from '../core/time';
import { drawFace } from '../clockface/draw';
import { plateHash } from '../router';
import { colorsFor, renderBackground } from '../render';

const MIN_BG_INTERVAL_MS = 90; // 최대 ~11fps — 그 이상은 낭비다
const MAX_BG_INTERVAL_MS = 1000;

export function mountNow(root: HTMLElement): () => void {
  const wrap = document.createElement('div');
  wrap.className = 'clock-wrap';
  const fieldCanvas = document.createElement('canvas');
  fieldCanvas.id = 'field';
  const faceCanvas = document.createElement('canvas');
  faceCanvas.id = 'face';
  wrap.appendChild(fieldCanvas);
  wrap.appendChild(faceCanvas);
  root.appendChild(wrap);

  const caption = document.createElement('p');
  caption.className = 'caption';
  root.appendChild(caption);

  const linkRow = document.createElement('p');
  linkRow.className = 'link-row';
  const permalink = document.createElement('a');
  permalink.textContent = '이 순간 저장 ↗';
  linkRow.appendChild(permalink);

  // 저전력 토글 (§11.2) — 켜면 배경이 분 단위로만 갱신
  let lowPower = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toggle = document.createElement('button');
  toggle.className = 'low-power';
  const syncToggle = (): void => {
    toggle.textContent = lowPower ? '저전력 켜짐 (분 단위)' : '저전력 꺼짐';
    toggle.setAttribute('aria-pressed', String(lowPower));
  };
  syncToggle();
  toggle.addEventListener('click', () => {
    lowPower = !lowPower;
    lastRenderedMinute = ''; // 즉시 다시 그리도록
    syncToggle();
  });
  linkRow.appendChild(toggle);
  root.appendChild(linkRow);

  const cssSize = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 720);
  const field = setupSquareCanvas(fieldCanvas, cssSize);
  const face = setupSquareCanvas(faceCanvas, cssSize);

  let colors = colorsFor(nowParts().ts);
  let lastRenderedMinute = '';
  let lastBgAt = 0;
  let bgInterval = MIN_BG_INTERVAL_MS;
  let lastCaptionSecond = '';
  let raf = 0;

  const loop = (frameTime: number): void => {
    const t = nowParts();
    const mk = minuteKey(t.ts);

    // --- 배경 (연속 위상, 적응형 간격) ---
    if (lowPower) {
      if (mk !== lastRenderedMinute) {
        const result = renderBackground(field.ctx, field.size, mk + ':00', {
          circleClip: true,
        });
        colors = { bg: result.bg, fg: result.fg };
        applyChrome(result.params.field, result.params.effect, result.params.seedHex, mk + ':00');
        lastRenderedMinute = mk;
      }
    } else if (frameTime - lastBgAt >= bgInterval || mk !== lastRenderedMinute) {
      const t0 = performance.now();
      const result = renderBackground(field.ctx, field.size, t.ts, {
        circleClip: true,
        frac: t.frac,
      });
      const cost = performance.now() - t0;
      // 렌더가 프레임 시간의 1/4만 차지하게 — 무거운 필드는 스스로 느려진다
      bgInterval = Math.min(MAX_BG_INTERVAL_MS, Math.max(MIN_BG_INTERVAL_MS, cost * 4));
      lastBgAt = frameTime;
      colors = { bg: result.bg, fg: result.fg };
      applyChrome(result.params.field, result.params.effect, result.params.seedHex, t.ts);
      lastRenderedMinute = mk;
    }

    // --- 캡션 시각은 초 단위로만 갱신 ---
    const sec = t.ts.slice(11);
    if (sec !== lastCaptionSecond) {
      lastCaptionSecond = sec;
      captionTime.textContent = sec;
      permalink.href = plateHash(t.ts);
    }

    // --- 시계 레이어 (매 프레임) ---
    drawFace(face.ctx, face.size, t, colors.fg, colors.bg);

    raf = requestAnimationFrame(loop);
  };

  const captionTime = document.createElement('span');
  const captionMeta = document.createElement('span');
  caption.appendChild(captionTime);
  caption.appendChild(captionMeta);

  function applyChrome(fieldId: string, effectId: string, seedHex: string, ts: string): void {
    document.body.style.background = colors.bg;
    document.body.style.color = colors.fg;
    captionMeta.textContent = ` · ${fieldId.toUpperCase()} / ${effectId.toUpperCase()} · ${seedHex}`;
    permalink.href = plateHash(ts);
  }

  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    document.body.style.background = '';
    document.body.style.color = '';
  };
}
