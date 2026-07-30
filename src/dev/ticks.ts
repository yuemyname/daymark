// W4.1 — 60틱 미리보기 (개발용, 프로덕션 빌드 제외).
// A: 1분치 60장 (초 위상 연속성), B: 1시간치 60장 (분 경계 재추첨).
// 둘은 다른 문제를 잡는다.

import { setupSquareCanvas } from '../core/canvas';
import { tsKey } from '../core/time';
import { addSeconds, isValidTsKey, minuteKey } from '../core/time';
import { renderBackground } from '../render';

const TILE = 128;

const q = new URLSearchParams(location.search).get('m');
const base = q && isValidTsKey(q + ':00') ? q + ':00' : minuteKey(tsKey(new Date())) + ':00';

const jobs: { ts: string; grid: HTMLElement; label: string }[] = [];

const gridMinute = document.getElementById('grid-minute');
const gridHour = document.getElementById('grid-hour');

for (let s = 0; s < 60; s++) {
  const ts = addSeconds(base, s);
  if (gridMinute) jobs.push({ ts, grid: gridMinute, label: ts.slice(11) });
}
for (let m = 0; m < 60; m++) {
  const ts = addSeconds(base.slice(0, 14) + '00:00', m * 60);
  if (gridHour) jobs.push({ ts, grid: gridHour, label: ts.slice(11, 16) });
}

// 한 프레임에 한 장 — 120장을 동기로 돌리면 수십 초 멈춘다
function pump(): void {
  const job = jobs.shift();
  if (!job) return;
  const tile = document.createElement('div');
  tile.className = 'tile';
  const canvas = document.createElement('canvas');
  tile.appendChild(canvas);
  const label = document.createElement('div');
  label.className = 'label';
  tile.appendChild(label);
  job.grid.appendChild(tile);

  const { ctx, size } = setupSquareCanvas(canvas, TILE);
  const result = renderBackground(ctx, size, job.ts, { circleClip: false });
  label.textContent = `${job.label} · ${result.params.field}/${result.params.effect}`;
  requestAnimationFrame(pump);
}
pump();
