// rAF 청크 렌더 스케줄러 (W2.4).
// 프레임당 스텝 수와 시간 예산 둘 다로 제한한다 —
// 스텝 제한이 없으면 빠른 시스템은 두 프레임 만에 끝나서 과정이 안 보인다.

const STEPS_PER_FRAME = 4;
const FRAME_BUDGET_MS = 8;

/** 점진 렌더 시작. 반환된 함수로 취소한다. */
export function startProgressiveRender(
  makeGen: () => Generator<void, void, void>,
): () => void {
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
