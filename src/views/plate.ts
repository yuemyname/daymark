// SPEC §11.3 — /t/:timestamp 판 상세.
// 그 순간의 큰 그림 + 시계 정지 겹침 + 파라미터 JSON + PNG 내보내기.
// 공유 가능한 퍼머링크 — "이 순간"을 저장하는 유일한 수단.

import { setupSquareCanvas } from '../core/canvas';
import { hmsOf, isValidTsKey } from '../core/time';
import { drawFace } from '../clockface/draw';
import { downloadBlob, EXPORT_SIZES, exportFilename, exportPng } from '../export/png';
import { renderBackground } from '../render';

export function mountPlate(root: HTMLElement, ts: string): () => void {
  if (!isValidTsKey(ts)) {
    const p = document.createElement('p');
    p.className = 'plate-error';
    p.textContent = `잘못된 타임스탬프: ${ts}`;
    root.appendChild(p);
    return () => {};
  }

  const wrap = document.createElement('div');
  wrap.className = 'clock-wrap';
  const fieldCanvas = document.createElement('canvas');
  const faceCanvas = document.createElement('canvas');
  faceCanvas.className = 'face-static';
  wrap.appendChild(fieldCanvas);
  wrap.appendChild(faceCanvas);
  root.appendChild(wrap);

  const caption = document.createElement('p');
  caption.className = 'caption';
  root.appendChild(caption);

  const cssSize = Math.min(window.innerWidth * 0.9, 720);
  const field = setupSquareCanvas(fieldCanvas, cssSize);
  const face = setupSquareCanvas(faceCanvas, cssSize);

  const result = renderBackground(field.ctx, field.size, ts, { circleClip: true });
  document.body.style.background = result.bg;
  document.body.style.color = result.fg;

  let withClock = true;
  const renderFace = (): void => {
    if (withClock) {
      const { h, m, s } = hmsOf(ts);
      drawFace(face.ctx, face.size, { h, m, s, frac: 0 }, result.fg, result.bg);
    } else {
      face.ctx.clearRect(0, 0, face.size, face.size);
    }
  };
  renderFace();

  caption.textContent = `${ts} · ${result.params.field.toUpperCase()} / ${result.params.effect.toUpperCase()} · ${result.params.seedHex}`;

  // 컨트롤 — 시계 토글 + PNG 내보내기
  const controls = document.createElement('div');
  controls.className = 'export-row';

  const clockToggle = document.createElement('button');
  clockToggle.className = 'export-btn';
  const syncClockToggle = (): void => {
    clockToggle.textContent = withClock ? '시계 끄기' : '시계 켜기';
  };
  syncClockToggle();
  clockToggle.addEventListener('click', () => {
    withClock = !withClock;
    syncClockToggle();
    renderFace();
  });
  controls.appendChild(clockToggle);

  const exportLabel = document.createElement('span');
  exportLabel.className = 'export-label';
  exportLabel.textContent = 'PNG';
  controls.appendChild(exportLabel);

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
      progress.textContent = '렌더 중…';
      // 렌더가 UI를 잠깐 막지 않게 다음 프레임으로 미룬다
      requestAnimationFrame(() => {
        exportPng(ts, size, withClock)
          .then((blob) => {
            downloadBlob(blob, exportFilename(ts, size));
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
    });
    buttons.push(btn);
    controls.appendChild(btn);
  }
  controls.appendChild(progress);
  root.appendChild(controls);

  const back = document.createElement('p');
  back.className = 'link-row';
  const backLink = document.createElement('a');
  backLink.href = '#/';
  backLink.textContent = '← 지금으로';
  back.appendChild(backLink);
  root.appendChild(back);

  const json = document.createElement('pre');
  json.className = 'plate-json';
  json.textContent = JSON.stringify(result.params, null, 2);
  root.appendChild(json);

  return () => {
    document.body.style.background = '';
    document.body.style.color = '';
  };
}
