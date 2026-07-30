// SPEC §10.1 / §11.2 — 눈금 + 바늘.
// 눈금 12개 굵게 + 60개 가늘게. 숫자는 없다 — 배경이 이미 복잡하다.
//
// 가독성 구현 노트: SPEC은 difference 합성 + 여백 파내기를 제안하지만,
// 배경이 별도 캔버스라 캔버스 내 합성으로는 아래 레이어를 건드릴 수 없다.
// 대신 같은 보장을 주는 이중 스트로크로 통일한다:
//   바늘·눈금을 배경색(bg) 두꺼운 스트로크 → 잉크색(fg) 본체 순으로 그린다.
//   어떤 밀도의 배경에서도 bg 헤일로가 본체를 분리한다.

export type FaceTime = { h: number; m: number; s: number; frac: number };

const TAU = Math.PI * 2;

export function drawFace(
  ctx: CanvasRenderingContext2D,
  size: number,
  t: FaceTime,
  fg: string,
  bg: string,
): void {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.scale(size, size);
  ctx.lineCap = 'round';

  // 눈금 — 60 가늘게 + 12 굵게
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2;
    const major = i % 5 === 0;
    const r0 = major ? 0.435 : 0.45;
    const r1 = 0.472;
    strokeLine(ctx, a, r0, r1, major ? 0.008 : 0.0028, bg, 0.004);
    strokeLine(ctx, a, r0, r1, major ? 0.008 : 0.0028, fg, 0);
  }

  // 바늘 — 초침은 frac으로 부드럽게 스윕
  const sec = ((t.s + t.frac) / 60) * TAU - Math.PI / 2;
  const min = ((t.m + t.s / 60) / 60) * TAU - Math.PI / 2;
  const hour = (((t.h % 12) + t.m / 60) / 12) * TAU - Math.PI / 2;

  drawHand(ctx, hour, 0.24, 0.016, fg, bg);
  drawHand(ctx, min, 0.36, 0.011, fg, bg);
  drawHand(ctx, sec, 0.42, 0.004, fg, bg);

  // 중심 축
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0.5, 0.5, 0.016, 0, TAU);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(0.5, 0.5, 0.01, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function strokeLine(
  ctx: CanvasRenderingContext2D,
  angle: number,
  r0: number,
  r1: number,
  width: number,
  color: string,
  halo: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width + halo * 2;
  ctx.beginPath();
  ctx.moveTo(0.5 + Math.cos(angle) * r0, 0.5 + Math.sin(angle) * r0);
  ctx.lineTo(0.5 + Math.cos(angle) * r1, 0.5 + Math.sin(angle) * r1);
  ctx.stroke();
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  angle: number,
  len: number,
  width: number,
  fg: string,
  bg: string,
): void {
  // 배경색 헤일로 (SPEC §10.1의 여백 0.004 상당) → 본체
  strokeLine(ctx, angle, -0.06, len, width, bg, 0.004);
  strokeLine(ctx, angle, -0.06, len, width, fg, 0);
}
