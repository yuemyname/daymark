// SPEC §4 — 밀도 버퍼 → 이중선형 lum(x, y).
// 이펙트는 필드 버퍼를 직접 만지지 않고 이 함수만 본다.

export type Lum = (x: number, y: number) => number;

/** [0,1]² → [0,1]. 버퍼는 res×res 밀도(0=백지, 1=잉크). */
export function bilinearSampler(buf: Float32Array, res: number): Lum {
  const max = res - 1;
  return (x, y) => {
    const fx = Math.min(max, Math.max(0, x * max));
    const fy = Math.min(max, Math.max(0, y * max));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(max, x0 + 1);
    const y1 = Math.min(max, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = buf[y0 * res + x0] ?? 0;
    const b = buf[y0 * res + x1] ?? 0;
    const c = buf[y1 * res + x0] ?? 0;
    const d = buf[y1 * res + x1] ?? 0;
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}
