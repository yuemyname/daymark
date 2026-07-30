// W1 임시 진입점 — 오늘의 params를 그대로 보여주는 스모크 테스트.
// W2에서 views/today.ts로 교체된다.

import { todayKey } from './core/date';
import { paramsFor } from './params';

const key = todayKey();
const params = paramsFor(key);

const el = document.getElementById('params');
if (el) el.textContent = JSON.stringify(params, null, 2);

document.body.style.background = params.palette.bg;
document.body.style.color = params.palette.inks[0] ?? '#888';
