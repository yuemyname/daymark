// 해시 라우터 — GitHub Pages(하위 경로)와 Netlify 어디서든 서버 설정 없이 동작한다.
//   #/            오늘 (기본)
//   #/archive     아카이브
//   #/d/2026-07-30T21:37   판 상세 (공백 대신 T)

export type Route =
  | { name: 'today' }
  | { name: 'archive' }
  | { name: 'plate'; key: string };

export function parseRoute(hash: string = location.hash): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h === 'archive') return { name: 'archive' };
  if (h.startsWith('d/')) {
    return { name: 'plate', key: decodeURIComponent(h.slice(2)).replace('T', ' ') };
  }
  return { name: 'today' };
}

export function plateHash(key: string): string {
  return `#/d/${key.replace(' ', 'T')}`;
}
