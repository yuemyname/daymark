// SPEC §8 — 해상도 독립 렌더링.
//
// ★ 스케일 방식 확정 (W2.1): 렌더 함수는 시작에 ctx.scale(size, size)를 걸고
//   이후 모든 좌표·반지름·선 굵기를 유닛 [0,1] 값 그대로 쓴다.
//   lineWidth도 유닛 단위다 (예: 0.002). 픽셀 상수 금지.
//   5개 시스템 전부 이 방식으로 통일한다 — enterUnitSpace/exitUnitSpace를 써라.
//
// 개수(입자 수, 격자 칸 수, 원 개수)는 스케일하지 않는다. 구도의 일부다.

/** 렌더 시작 시 호출. 이후 모든 그리기는 유닛 좌표 [0,1]². */
export function enterUnitSpace(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.save();
  ctx.scale(size, size);
}

/** 렌더 끝에서 호출. */
export function exitUnitSpace(ctx: CanvasRenderingContext2D): void {
  ctx.restore();
}

/**
 * 정사각 캔버스를 CSS 크기 + DPR로 세팅하고 ctx와 디바이스 픽셀 한 변을 돌려준다.
 * DPR은 2로 캡 — 3x 기기에서 썸네일까지 3배로 그릴 이유가 없다.
 */
export function setupSquareCanvas(
  canvas: HTMLCanvasElement,
  cssSize: number,
): { ctx: CanvasRenderingContext2D; size: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.round(cssSize * dpr);
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return { ctx, size };
}
