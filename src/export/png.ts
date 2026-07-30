// SPEC §11.3 — PNG 내보내기. 오프스크린에 동일 코드로 재렌더 후 toBlob.
// §9 해상도 독립의 검수 지점 — 4096 결과가 화면과 다르면 어딘가에서
// 픽셀 상수를 쓴 것이다 (디더링의 pixelSize 비례 규칙이 제1 용의자).

import { hmsOf } from '../core/time';
import { drawFace } from '../clockface/draw';
import { renderBackground } from '../render';

export type ExportSize = 1024 | 2048 | 4096;
export const EXPORT_SIZES: readonly ExportSize[] = [1024, 2048, 4096];

export async function exportPng(
  ts: string,
  size: ExportSize,
  withClock: boolean,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  const result = renderBackground(ctx, size, ts, { circleClip: true });
  if (withClock) {
    const { h, m, s } = hmsOf(ts);
    // 별도 레이어 없이 위에 바로 — 정지 상태 frac=0
    drawFace(ctxNoClear(ctx), size, { h, m, s, frac: 0 }, result.fg, result.bg);
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

/** drawFace는 시작에 clearRect를 하므로, 내보내기에선 그걸 무시하는 래퍼를 씌운다. */
function ctxNoClear(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  return new Proxy(ctx, {
    get(t, k) {
      if (k === 'clearRect') return () => undefined;
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) {
      Reflect.set(t, k, v);
      return true;
    },
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function exportFilename(ts: string, size: ExportSize): string {
  return `daymark-${ts.replace(/:/g, '')}-${size}.png`;
}
