// SPEC §2.2 — 날짜는 항상 KST 기준.
// 사용자의 로컬 타임존을 쓰면 비행기만 타도 그림이 바뀐다.
// KST는 서머타임이 없는 고정 UTC+9라 자정 계산도 오프셋 산술로 안전하다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// 판 키 — 분 단위. "2026-07-30 21:37" (KST)
const PLATE_RE = /^(\d{4})-(\d{2})-(\d{2}) ([01]\d|2[0-3]):([0-5]\d)$/;

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

/**
 * 지금 이 순간의 판 키 — 분 단위, KST. "2026-07-30 21:37"
 * 그림은 이 키 하나로 완전히 결정된다. (원안은 하루 단위였으나 1분 주기로 변경)
 */
export function plateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string): string => {
    const v = parts.find((p) => p.type === t)?.value;
    if (v === undefined) throw new Error(`missing date part: ${t}`);
    return v;
  };
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** "YYYY-MM-DD HH:mm" 형식이면서 실존하는 시각인지. */
export function isValidPlateKey(key: string): boolean {
  const m = PLATE_RE.exec(key);
  if (!m) return false;
  return isValidDateKey(key.slice(0, 10));
}

/** 판 키에 n분을 더한다. 시·일·월·연 경계는 UTC 산술에 맡긴다 (KST는 고정 오프셋). */
export function addMinutes(key: string, n: number): string {
  const m = PLATE_RE.exec(key);
  if (!m) throw new Error(`invalid plateKey: ${key}`);
  const t =
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) +
    n * MINUTE_MS;
  const d = new Date(t);
  const pad = (v: number): string => v.toString().padStart(2, '0');
  return `${d.getUTCFullYear().toString().padStart(4, '0')}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 판 키의 날짜 부분 ("2026-07-30") — dateGlyph 마스크 등에 쓴다. */
export function dayOf(key: string): string {
  return key.slice(0, 10);
}

/** 다음 분 경계까지 남은 ms. 분 경계는 모든 타임존에서 동일하다. */
export function msUntilNextMinute(now: Date = new Date()): number {
  const rem = now.getTime() % MINUTE_MS;
  return rem === 0 ? MINUTE_MS : MINUTE_MS - rem;
}

/** 다음 KST 자정까지 남은 ms. */
export function msUntilNextMidnightKST(now: Date = new Date()): number {
  const key = todayKey(now);
  const m = KEY_RE.exec(key);
  if (!m) throw new Error(`unreachable: bad todayKey ${key}`);
  // KST 날짜 d의 다음 자정 = UTC로 (d+1일 00:00) - 9h
  const nextMidnightUtc =
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1) - KST_OFFSET_MS;
  return nextMidnightUtc - now.getTime();
}
