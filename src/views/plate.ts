// §9.4 판 상세 — 특정 분의 판.
// 큰 그림 + 파라미터 JSON + PNG 내보내기 (1024 / 2048 / 4096).

import { setupSquareCanvas } from '../core/canvas';
import { isValidPlateKey } from '../core/date';
import { rngFor } from '../core/rng';
import { downloadBlob, EXPORT_SIZES, exportFilename, exportPng } from '../export/png';
import { paramsFor } from '../params';
import { renderPlanFor } from '../systems';
import { startProgressiveRender } from './progressive';

export function mountPlate(root: HTMLElement, key: string): () => void {
  if (!isValidPlateKey(key)) {
    const p = document.createElement('p');
    p.className = 'plate-error';
    p.textContent = `잘못된 판 키: ${key}`;
    root.appendChild(p);
    return () => {};
  }

  const params = paramsFor(key);
  const plan = renderPlanFor(key, params);
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
  root.appendChild(figure);

  // PNG 내보내기 (W6.2~W6.3)
  const exportRow = document.createElement('div');
  exportRow.className = 'export-row';
  const exportLabel = document.createElement('span');
  exportLabel.className = 'export-label';
  exportLabel.textContent = 'PNG';
  exportRow.appendChild(exportLabel);

  const progress = document.createElement('span');
  progress.className = 'export-progress';

  const buttons: HTMLButtonElement[] = [];
  let exporting = false;
  for (const size of EXPORT_SIZES) {
    const btn = document.createElement('button');
    btn.className = 'export-btn';
    btn.textContent = String(size);
    btn.addEventListener('click', () => {
      if (exporting) return;
      exporting = true;
      buttons.forEach((b) => (b.disabled = true));
      progress.textContent = '0%';
      exportPng(key, size, (f) => {
        progress.textContent = `${Math.round(f * 100)}%`;
      })
        .then((blob) => {
          downloadBlob(blob, exportFilename(key, size));
          progress.textContent = '완료';
        })
        .catch(() => {
          progress.textContent = '실패';
        })
        .finally(() => {
          exporting = false;
          buttons.forEach((b) => (b.disabled = false));
        });
    });
    buttons.push(btn);
    exportRow.appendChild(btn);
  }
  exportRow.appendChild(progress);
  root.appendChild(exportRow);

  const json = document.createElement('pre');
  json.className = 'plate-json';
  json.textContent = JSON.stringify(params, null, 2);
  root.appendChild(json);

  const cssSize = Math.min(window.innerWidth * 0.9, 720);
  const { ctx, size } = setupSquareCanvas(canvas, cssSize);
  const cancel = startProgressiveRender(() =>
    plan.fn({ ctx, size, params: plan.params, rng: rngFor(key + ':render') }),
  );

  return cancel;
}
