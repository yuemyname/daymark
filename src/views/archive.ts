// §9.3 아카이브 — 최근 N장 그리드 (1분 주기 체제에 맞춘 재설계).
// 지금 이 분부터 과거로 거슬러 올라가며 썸네일을 깐다.
// 썸네일은 저장하지 않고 그 자리에서 렌더한다 (§1).
//
// 성능 장치 (원 SPEC의 W5.2~W5.3 그대로):
//   - IntersectionObserver — 화면에 들어온 칸만 렌더
//   - 렌더 큐 — 프레임당 1칸 (동기로 다 돌리면 메인 스레드가 1초 이상 막힌다)
//   - ImageBitmap 캐시 — 스크롤로 되돌아온 칸은 즉시 표시

import { setupSquareCanvas } from '../core/canvas';
import { addMinutes, dayOf, plateKey } from '../core/date';
import { rngFor } from '../core/rng';
import { paramsFor } from '../params';
import { plateHash } from '../router';
import { resolveRender } from '../systems';

const THUMB_CSS = 128;
const BATCH = 60;
const MAX_CACHE = 600;

// 모듈 스코프 캐시 — 뷰를 나갔다 와도 살아 있다. Map 삽입 순서로 오래된 것부터 비운다.
const bitmapCache = new Map<string, ImageBitmap>();

function cachePut(key: string, bmp: ImageBitmap): void {
  bitmapCache.set(key, bmp);
  if (bitmapCache.size > MAX_CACHE) {
    const oldest = bitmapCache.keys().next().value;
    if (oldest !== undefined) {
      bitmapCache.get(oldest)?.close();
      bitmapCache.delete(oldest);
    }
  }
}

export function mountArchive(root: HTMLElement): () => void {
  let disposed = false;
  let offset = 0; // 현재 분에서 몇 분 전까지 깔았는지
  let lastDay = '';
  const newest = plateKey();

  const title = document.createElement('h2');
  title.className = 'archive-title';
  title.textContent = '아카이브 — 최근 판부터';
  root.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'archive-grid';
  root.appendChild(grid);

  const sentinel = document.createElement('div');
  sentinel.className = 'archive-sentinel';
  root.appendChild(sentinel);

  // 렌더 큐 — 프레임당 1칸
  const queue: { key: string; canvas: HTMLCanvasElement }[] = [];
  let pumping = false;
  function pump(): void {
    if (disposed) return;
    const job = queue.shift();
    if (!job) {
      pumping = false;
      return;
    }
    renderThumb(job.key, job.canvas);
    requestAnimationFrame(pump);
  }
  function enqueue(job: { key: string; canvas: HTMLCanvasElement }): void {
    queue.push(job);
    if (!pumping) {
      pumping = true;
      requestAnimationFrame(pump);
    }
  }

  function renderThumb(key: string, canvas: HTMLCanvasElement): void {
    const { ctx, size } = setupSquareCanvas(canvas, THUMB_CSS);
    const cached = bitmapCache.get(key);
    if (cached) {
      ctx.drawImage(cached, 0, 0, size, size);
      return;
    }
    const params = paramsFor(key);
    const { fn } = resolveRender(params.system);
    const gen = fn({ ctx, size, params, rng: rngFor(key + ':render') });
    while (!gen.next().done) {
      /* 썸네일은 한 번에 끝까지 — 128px라 싸다 */
    }
    void createImageBitmap(canvas).then((bmp) => {
      if (disposed) bmp.close();
      else cachePut(key, bmp);
    });
  }

  // 화면에 들어온 칸만 큐에 넣는다
  const tileObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        tileObserver.unobserve(e.target);
        const canvas = e.target.querySelector('canvas');
        const key = e.target.getAttribute('data-key');
        if (canvas instanceof HTMLCanvasElement && key) enqueue({ key, canvas });
      }
    },
    { rootMargin: '300px' },
  );

  function addBatch(): void {
    for (let i = 0; i < BATCH; i++, offset++) {
      const key = addMinutes(newest, -offset);
      const day = dayOf(key);
      if (day !== lastDay) {
        const divider = document.createElement('div');
        divider.className = 'archive-day';
        divider.textContent = day;
        grid.appendChild(divider);
        lastDay = day;
      }
      const tile = document.createElement('a');
      tile.className = 'archive-tile';
      tile.href = plateHash(key);
      tile.setAttribute('data-key', key);
      const canvas = document.createElement('canvas');
      tile.appendChild(canvas);
      const label = document.createElement('span');
      label.className = 'archive-time';
      label.textContent = key.slice(11);
      tile.appendChild(label);
      grid.appendChild(tile);
      tileObserver.observe(tile);
    }
  }

  // 바닥 감시 — 닿으면 다음 배치
  const moreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) addBatch();
    },
    { rootMargin: '600px' },
  );

  addBatch();
  moreObserver.observe(sentinel);

  return () => {
    disposed = true;
    queue.length = 0;
    tileObserver.disconnect();
    moreObserver.disconnect();
  };
}
