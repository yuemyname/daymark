// §9.4 판 상세 — 특정 분의 판.
// W5에서는 큰 그림 + 파라미터 JSON까지. PNG 내보내기는 W6.2에서 붙는다.

import { setupSquareCanvas } from '../core/canvas';
import { isValidPlateKey } from '../core/date';
import { rngFor } from '../core/rng';
import { configFor, paramsFor } from '../params';
import { resolveRender } from '../systems';
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
  const { id: usedSystem, fn: render } = resolveRender(params.system);
  const renderParams =
    usedSystem === params.system
      ? params
      : {
          ...params,
          system: usedSystem,
          config: configFor(usedSystem, rngFor(key + ':params:fallback')),
        };
  root.style.setProperty('--accent', params.palette.accent);

  const figure = document.createElement('figure');
  figure.className = 'plate';

  const canvas = document.createElement('canvas');
  figure.appendChild(canvas);

  const caption = document.createElement('figcaption');
  caption.className = 'caption';
  caption.append(`${key} · ${usedSystem.toUpperCase()} · `);
  const seed = document.createElement('span');
  seed.className = 'seed';
  seed.textContent = params.seedHex;
  caption.appendChild(seed);
  figure.appendChild(caption);
  root.appendChild(figure);

  const json = document.createElement('pre');
  json.className = 'plate-json';
  json.textContent = JSON.stringify(params, null, 2);
  root.appendChild(json);

  const cssSize = Math.min(window.innerWidth * 0.9, 720);
  const { ctx, size } = setupSquareCanvas(canvas, cssSize);
  const cancel = startProgressiveRender(() =>
    render({ ctx, size, params: renderParams, rng: rngFor(key + ':render') }),
  );

  return cancel;
}
