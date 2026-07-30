// W1 임시 진입점 — 오늘의 params를 그대로 보여주는 스모크 테스트.
// W2에서 views/today.ts로 교체된다.

import { todayKey } from './core/date';
import { paramsFor } from './params';

const key = todayKey();
const params = paramsFor(key);

const el = document.getElementById('params');
if (el) el.textContent = JSON.stringify(params, null, 2);

// 크롬은 흰 배경 그대로 두고 (SPEC §9.1 — UI는 무채색),
// 오늘의 팔레트는 칩으로만 보여준다.
const chips = document.getElementById('chips');
if (chips) {
  for (const color of [params.palette.bg, ...params.palette.inks]) {
    const d = document.createElement('div');
    d.style.background = color;
    d.title = color;
    chips.appendChild(d);
  }
}
