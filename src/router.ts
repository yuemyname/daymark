// 해시 라우터 — GitHub Pages 하위 경로에서도 서버 설정 없이 동작한다.
//   #/                      지금 (기본)
//   #/t/2026-07-30T14:23:07 판 상세 (퍼머링크)

export type Route = { name: 'now' } | { name: 'plate'; ts: string };

export function parseRoute(hash: string = location.hash): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h.startsWith('t/')) return { name: 'plate', ts: decodeURIComponent(h.slice(2)) };
  return { name: 'now' };
}

export function plateHash(ts: string): string {
  return `#/t/${ts}`;
}
