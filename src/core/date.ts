// SPEC §2.2 — 날짜는 항상 KST 기준.
// 사용자의 로컬 타임존을 쓰면 비행기만 타도 그림이 바뀐다.
// KST는 서머타임이 없는 고정 UTC+9라 자정 계산도 오프셋 산술로 안전하다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 지금 이 순간의 KST 날짜 키. "2026-07-30" 형태. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** "YYYY-MM-DD"이면서 실제로 존재하는 날짜인지 (2026-02-30 같은 것 거부). */
export function isValidDateKey(key: string): boolean {
  const m = KEY_RE.exec(key);
  if (!m) return false;
  const [, ys, ms, ds] = m;
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  return (
    back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d
  );
}

/** dateKey에 n일을 더한 키. 월말·윤일·연말 경계는 Date.UTC 산술에 맡긴다. */
export function addDays(key: string, n: number): string {
  const m = KEY_RE.exec(key);
  if (!m) throw new Error(`invalid dateKey: ${key}`);
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n);
  const d = new Date(t);
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const da = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** 두 키의 차이 (일 단위, b - a). */
export function diffDays(a: string, b: string): number {
  const pa = KEY_RE.exec(a);
  const pb = KEY_RE.exec(b);
  if (!pa || !pb) throw new Error(`invalid dateKey: ${a} / ${b}`);
  const ta = Date.UTC(Number(pa[1]), Number(pa[2]) - 1, Number(pa[3]));
  const tb = Date.UTC(Number(pb[1]), Number(pb[2]) - 1, Number(pb[3]));
  return Math.round((tb - ta) / DAY_MS);
}

/** 다음 KST 자정까지 남은 ms. 카운트다운(§9.2)에 쓴다. */
export function msUntilNextMidnightKST(now: Date = new Date()): number {
  const key = todayKey(now);
  const m = KEY_RE.exec(key);
  if (!m) throw new Error(`unreachable: bad todayKey ${key}`);
  // KST 날짜 d의 다음 자정 = UTC로 (d+1일 00:00) - 9h
  const nextMidnightUtc =
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1) - KST_OFFSET_MS;
  return nextMidnightUtc - now.getTime();
}
