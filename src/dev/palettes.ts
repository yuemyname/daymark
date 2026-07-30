// W0.2 — 팔레트 100개를 눈으로 검수하는 개발용 페이지.
// 프로덕션 빌드에는 들어가지 않는다 (vite build 입력은 index.html뿐).
// 대비 미달(ΔL < 0.35)인 카드는 빨간 테두리로 표시된다 — 0개여야 통과.

import { oklch } from 'culori';
import { addDays, todayKey } from '../core/date';
import { MIN_DELTA_L, paletteFor } from '../core/palette';
import { rngFor } from '../core/rng';

const grid = document.getElementById('grid');
const summary = document.getElementById('summary');

function deltaLOk(bg: string, ink: string): boolean {
  const a = oklch(bg);
  const b = oklch(ink);
  if (!a || !b) return false;
  return Math.abs((a.l ?? 0) - (b.l ?? 0)) >= MIN_DELTA_L - 1e-6;
}

let failCount = 0;
const start = todayKey();

for (let i = 0; i < 100; i++) {
  const key = addDays(start, i);
  const palette = paletteFor(rngFor(key + ':params'));

  const bad = palette.inks.some((ink) => !deltaLOk(palette.bg, ink));
  if (bad) failCount++;

  const card = document.createElement('div');
  card.className = 'card' + (bad ? ' fail' : '');
  card.style.background = palette.bg;

  const sw = document.createElement('div');
  sw.className = 'swatches';
  for (const ink of palette.inks) {
    const d = document.createElement('div');
    d.style.background = ink;
    sw.appendChild(d);
  }
  card.appendChild(sw);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.style.color = palette.inks[0] ?? '#888';
  meta.textContent = `${key} · ${palette.mode} · accent ${palette.accent}`;
  card.appendChild(meta);

  grid?.appendChild(card);
}

if (summary) {
  summary.textContent = `대비 미달: ${failCount} / 100 (완료 기준: 0)`;
  summary.style.color = failCount === 0 ? '#7c7' : '#ff3355';
}
