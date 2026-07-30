// §9.4 PNG 내보내기 (W6.2).
// 오프스크린 캔버스에 화면과 동일한 코드로 재렌더한 뒤 toBlob.
// §8 해상도 독립 덕에 size만 바꾸면 같은 구도가 나온다 — 여기가 그 검수 지점이다.
//
// 4096은 시스템에 따라 수 초 걸린다. rAF 청크로 나눠 UI를 멈추지 않고,
// 전체 스텝 수를 미리 세어(그리기 없는 드라이런) 진행률을 보고한다.

import { rngFor } from '../core/rng';
import { paramsFor } from '../params';
import { renderPlanFor } from '../systems';

export type ExportSize = 1024 | 2048 | 4096;
export const EXPORT_SIZES: readonly ExportSize[] = [1024, 2048, 4096];

const CHUNK_BUDGET_MS = 12;

/** 그리지 않는 ctx — 스텝 수 셈 전용. 시스템은 ctx 프로퍼티를 읽지 않는다. */
function noopCtx(): CanvasRenderingContext2D {
  return new Proxy(
    {},
    {
      get: () => () => undefined,
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
}

export async function exportPng(
  key: string,
  size: ExportSize,
  onProgress: (fraction: number) => void,
): Promise<Blob> {
  const plan = renderPlanFor(key, paramsFor(key));

  // 1) 드라이런으로 전체 스텝 수 확보 (래스터화가 없어 빠르다)
  let total = 0;
  {
    const gen = plan.fn({
      ctx: noopCtx(),
      size,
      params: plan.params,
      rng: rngFor(key + ':render'),
    });
    while (!gen.next().done) total++;
  }

  // 2) 실제 렌더 — rAF 청크
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  const gen = plan.fn({ ctx, size, params: plan.params, rng: rngFor(key + ':render') });
  let done = 0;
  await new Promise<void>((resolve) => {
    const tick = (): void => {
      const t0 = performance.now();
      for (;;) {
        if (gen.next().done) {
          resolve();
          return;
        }
        done++;
        if (performance.now() - t0 > CHUNK_BUDGET_MS) break;
      }
      onProgress(total > 0 ? done / total : 0);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  onProgress(1);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/png',
    );
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

export function exportFilename(key: string, size: ExportSize): string {
  return `daymark-${key.replace(' ', '-').replace(':', '')}-${size}.png`;
}
