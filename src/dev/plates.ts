// 개발용 — 연속된 24분의 판을 한 화면에 렌더한다.
// 시스템 5종이 실제 팔레트로 어떻게 나오는지 훑어보는 용도.
// W4.2에서 90장 튜닝 그리드로 확장될 예정.

import { setupSquareCanvas } from '../core/canvas';
import { addMinutes, isValidPlateKey, plateKey } from '../core/date';
import { rngFor } from '../core/rng';
import { paramsFor } from '../params';
import { resolveRender } from '../systems';

const COUNT = 24;
const TILE_CSS = 240;

const grid = document.getElementById('grid');
const queryStart = new URLSearchParams(location.search).get('start')?.replace('T', ' ');
const start = queryStart && isValidPlateKey(queryStart) ? queryStart : plateKey();

const queue: (() => void)[] = [];

for (let i = 0; i < COUNT; i++) {
  const key = addMinutes(start, i);
  const params = paramsFor(key);
  const { id, fn } = resolveRender(params.system);

  const tile = document.createElement('div');
  tile.className = 'tile';
  const canvas = document.createElement('canvas');
  tile.appendChild(canvas);
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `${key} · ${id} · ${params.palette.mode}`;
  tile.appendChild(label);
  grid?.appendChild(tile);

  queue.push(() => {
    const { ctx, size } = setupSquareCanvas(canvas, TILE_CSS);
    const gen = fn({ ctx, size, params, rng: rngFor(key + ':render') });
    let done = false;
    while (!done) done = gen.next().done === true;
  });
}

// 한 프레임에 한 장씩 — 24장을 동기로 돌리면 메인 스레드가 수 초 막힌다
function pump(): void {
  const job = queue.shift();
  if (!job) return;
  job();
  requestAnimationFrame(pump);
}
pump();
