// SPEC §2.2 — 시각은 항상 KST.
// sv-SE 로케일이 "YYYY-MM-DD HH:mm:ss"를 뱉는다. 직접 조립하지 말 것.
// KST는 서머타임 없는 고정 UTC+9라 경계 산술도 안전하다.

const FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const TS_RE = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

/** "2026-07-30T14:23:07" (KST) */
export function tsKey(now: Date): string {
  return FMT.format(now).replace(' ', 'T');
}

export function hourKey(ts: string): string {
  return ts.slice(0, 13); // "2026-07-30T14"
}

export function minuteKey(ts: string): string {
  return ts.slice(0, 16); // "2026-07-30T14:23"
}

export function secondOf(ts: string): number {
  return +ts.slice(17, 19);
}

export function hmsOf(ts: string): { h: number; m: number; s: number } {
  return { h: +ts.slice(11, 13), m: +ts.slice(14, 16), s: +ts.slice(17, 19) };
}

/** "YYYY-MM-DDTHH:mm:ss" 형식이면서 실존하는 시각인지. */
export function isValidTsKey(ts: string): boolean {
  const m = TS_RE.exec(ts);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function parseUtcMs(ts: string): number {
  const m = TS_RE.exec(ts);
  if (!m) throw new Error(`invalid ts: ${ts}`);
  return Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  );
}

function formatUtc(t: number): string {
  const d = new Date(t);
  const pad = (v: number): string => v.toString().padStart(2, '0');
  return (
    `${d.getUTCFullYear().toString().padStart(4, '0')}-${pad(d.getUTCMonth() + 1)}-` +
    `${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
      d.getUTCSeconds(),
    )}`
  );
}

/** ts에 n초를 더한다. 분·시·일·월·연 경계는 UTC 산술에 맡긴다. */
export function addSeconds(ts: string, n: number): string {
  return formatUtc(parseUtcMs(ts) + n * 1000);
}

/** 시(hour) 키("YYYY-MM-DDTHH")에 n시간을 더한 시 키. */
export function addHours(hk: string, n: number): string {
  return formatUtc(parseUtcMs(hk + ':00:00') + n * 3_600_000).slice(0, 13);
}
