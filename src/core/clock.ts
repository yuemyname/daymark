// SPEC §2.4 / §13 — Date를 읽는 유일한 파일. 여기서 틱을 만들어 아래로 흘려보낸다.
//
// - setInterval(1000)이 아니라 다음 초 경계까지의 잔여 시간으로 setTimeout 재설정
//   (setInterval은 드리프트가 쌓여 초침과 배경이 어긋난다)
// - document.hidden이면 틱을 완전히 정지한다
// - 매 틱마다 Date를 새로 읽으므로, 한 틱이 밀려도 큐에 쌓이지 않고 건너뛰어진다

import { tsKey } from './time';

export function startTicker(onTick: (ts: string) => void): () => void {
  let timer: number | undefined;
  let stopped = false;

  const schedule = (): void => {
    if (stopped) return;
    const wait = 1000 - (Date.now() % 1000) + 5; // 경계 직후 +5ms 여유
    timer = window.setTimeout(() => {
      if (!document.hidden) onTick(tsKey(new Date()));
      schedule();
    }, wait);
  };

  const onVisible = (): void => {
    if (!document.hidden && !stopped) onTick(tsKey(new Date()));
  };
  document.addEventListener('visibilitychange', onVisible);

  onTick(tsKey(new Date()));
  schedule();

  return () => {
    stopped = true;
    if (timer !== undefined) window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/** 지금 시각 (KST) — 시계 바늘용. frac은 현재 초의 진행률 [0,1). */
export function nowParts(): { ts: string; h: number; m: number; s: number; frac: number } {
  const now = new Date();
  const ts = tsKey(now);
  return {
    ts,
    h: +ts.slice(11, 13),
    m: +ts.slice(14, 16),
    s: +ts.slice(17, 19),
    frac: now.getMilliseconds() / 1000,
  };
}
