// SPEC §11.2 — `/` 지금.
// 캔버스 2장 (§10): #field 1Hz (초 경계에서만), #face 60Hz (rAF, 눈금+바늘).
// 점진 렌더 연출은 없다 — 1초마다 갱신되는 화면에서 그리는 과정을 보여주면
// 영원히 완성되지 않는 화면이 된다.

import { setupSquareCanvas } from '../core/canvas';
import { nowParts, startTicker } from '../core/clock';
import { minuteKey } from '../core/time';
import { drawFace } from '../clockface/draw';
import { plateHash } from '../router';
import { colorsFor, renderBackground } from '../render';

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
    syncToggle();
  });
  linkRow.appendChild(toggle);
  root.appendChild(linkRow);

  const cssSize = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 720);
  const field = setupSquareCanvas(fieldCanvas, cssSize);
  const face = setupSquareCanvas(faceCanvas, cssSize);

  let lastRenderedMinute = '';
  let colors = colorsFor(nowParts().ts);

  const onTick = (ts: string): void => {
    // 저전력: 분이 바뀔 때만 (그 분의 :00 상태로)
    if (lowPower) {
      const mk = minuteKey(ts);
      if (mk === lastRenderedMinute) return;
      lastRenderedMinute = mk;
      ts = mk + ':00';
    }
    const result = renderBackground(field.ctx, field.size, ts, { circleClip: true });
    colors = { bg: result.bg, fg: result.fg };
    document.body.style.background = result.bg;
    document.body.style.color = result.fg;
    caption.textContent = `${ts.slice(11)} · ${result.params.field.toUpperCase()} / ${result.params.effect.toUpperCase()} · ${result.params.seedHex}`;
    permalink.href = plateHash(ts);
    if (!lowPower) lastRenderedMinute = minuteKey(ts);
  };

  const stopTicker = startTicker(onTick);

  // 시계 레이어 — 60Hz. 숨겨지면 rAF는 브라우저가 알아서 멈춘다
  let raf = 0;
  const faceLoop = (): void => {
    const t = nowParts();
    drawFace(face.ctx, face.size, t, colors.fg, colors.bg);
    raf = requestAnimationFrame(faceLoop);
  };
  raf = requestAnimationFrame(faceLoop);

  return () => {
    stopTicker();
    cancelAnimationFrame(raf);
    document.body.style.background = '';
    document.body.style.color = '';
  };
}
