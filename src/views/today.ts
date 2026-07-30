// SPEC §9.2 — `/` 오늘 화면.
// 정사각 캔버스 + 판 캡션 + KST 자정 카운트다운.
// 그림은 완성본을 툭 띄우지 않고 rAF로 그려지는 과정을 보여준다 (W2.4).

import { setupSquareCanvas } from '../core/canvas';
import { msUntilNextMidnightKST, todayKey } from '../core/date';
import { rngFor } from '../core/rng';
import { configFor, paramsFor } from '../params';
import { resolveRender } from '../systems';

// 프레임당 렌더 예산 — 스텝 수와 시간(ms) 둘 다로 제한한다.
// 스텝 제한이 없으면 빠른 시스템은 두 프레임 만에 끝나서 과정이 안 보인다.
const STEPS_PER_FRAME = 4;
const FRAME_BUDGET_MS = 8;

export function mountToday(root: HTMLElement): void {
  let currentKey = '';
  let cancelRender: (() => void) | null = null;
  let countdownTimer: number | undefined;

  function show(): void {
    const key = todayKey();
    if (key === currentKey) return;
    currentKey = key;

    const params = paramsFor(key);
    // 미구현 시스템이면 subdivision 폴백 (W3까지의 임시 동작).
    // config도 폴백 시스템에 맞게 별도 스트림에서 결정적으로 재생성한다.
    const { id: usedSystem, fn: render } = resolveRender(params.system);
    const renderParams =
      usedSystem === params.system
        ? params
        : {
            ...params,
            system: usedSystem,
            config: configFor(usedSystem, rngFor(key + ':params:fallback')),
          };
    root.innerHTML = '';
    root.style.setProperty('--accent', params.palette.accent);

    const figure = document.createElement('figure');
    figure.className = 'plate';

    const canvas = document.createElement('canvas');
    figure.appendChild(canvas);

    const caption = document.createElement('figcaption');
    caption.className = 'caption';
    caption.textContent = `${key} · ${usedSystem.toUpperCase()} · ${params.seedHex}`;
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
      render({
        ctx,
        size,
        params: renderParams,
        rng: rngFor(key + ':render'),
      }),
    );

    // 카운트다운 — 매초 갱신, 자정을 넘으면 새 그림
    if (countdownTimer !== undefined) window.clearInterval(countdownTimer);
    const tickClock = (): void => {
      const ms = msUntilNextMidnightKST();
      countdown.textContent = `다음 장까지 ${formatMs(ms)}`;
      if (todayKey() !== currentKey) show();
    };
    tickClock();
    countdownTimer = window.setInterval(tickClock, 1000);
  }

  show();
}

/** rAF 청크 렌더. 반환된 함수로 취소한다. */
function startProgressiveRender(makeGen: () => Generator<void, void, void>): () => void {
  const gen = makeGen();
  let raf = 0;
  const tick = (): void => {
    const start = performance.now();
    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      if (gen.next().done) return;
      if (performance.now() - start > FRAME_BUDGET_MS) break;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
