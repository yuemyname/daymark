// SPEC §9.2 — `/` 지금 화면.
// 정사각 캔버스 + 판 캡션 + 다음 분까지 카운트다운 (1분 주기).
// 그림은 완성본을 툭 띄우지 않고 rAF로 그려지는 과정을 보여준다 (W2.4).

import { setupSquareCanvas } from '../core/canvas';
import { msUntilNextMinute, plateKey } from '../core/date';
import { rngFor } from '../core/rng';
import { paramsFor } from '../params';
import { renderPlanFor } from '../systems';
import { startProgressiveRender } from './progressive';

export function mountToday(root: HTMLElement): () => void {
  let currentKey = '';
  let cancelRender: (() => void) | null = null;
  let countdownTimer: number | undefined;

  function show(): void {
    const key = plateKey();
    if (key === currentKey) return;
    currentKey = key;

    const params = paramsFor(key);
    const plan = renderPlanFor(key, params);
    root.innerHTML = '';
    root.style.setProperty('--accent', params.palette.accent);

    const figure = document.createElement('figure');
    figure.className = 'plate';

    const canvas = document.createElement('canvas');
    figure.appendChild(canvas);

    const caption = document.createElement('figcaption');
    caption.className = 'caption';
    caption.append(`${key} · ${plan.id.toUpperCase()} · `);
    const seed = document.createElement('span');
    seed.className = 'seed';
    seed.textContent = params.seedHex;
    caption.appendChild(seed);
    figure.appendChild(caption);

    const countdown = document.createElement('p');
    countdown.className = 'countdown';
    root.appendChild(figure);
    root.appendChild(countdown);

    // 캔버스 크기 — min(90vw, 720px)
    const cssSize = Math.min(window.innerWidth * 0.9, 720);
    const { ctx, size } = setupSquareCanvas(canvas, cssSize);

    cancelRender?.();
    cancelRender = startProgressiveRender(() =>
      plan.fn({
        ctx,
        size,
        params: plan.params,
        rng: rngFor(key + ':render'),
      }),
    );

    // 카운트다운 — 매초 갱신, 분이 넘어가면 새 그림
    if (countdownTimer !== undefined) window.clearInterval(countdownTimer);
    const tickClock = (): void => {
      const ms = msUntilNextMinute();
      countdown.textContent = `다음 장까지 ${formatMs(ms)}`;
      if (plateKey() !== currentKey) show();
    };
    tickClock();
    countdownTimer = window.setInterval(tickClock, 1000);
  }

  show();

  return () => {
    cancelRender?.();
    if (countdownTimer !== undefined) window.clearInterval(countdownTimer);
  };
}

function formatMs(ms: number): string {
  const s = Math.min(60, Math.max(0, Math.ceil(ms / 1000)));
  return `${s.toString().padStart(2, '0')}초`;
}
