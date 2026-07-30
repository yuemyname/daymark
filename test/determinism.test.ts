// SPEC §12 L1 — 파라미터 스냅샷.
// 고정 타임스탬프 16개의 params 해시를 기록한다.
// 이펙트를 추가·수정해도 과거 시각의 params가 바뀌지 않는 것 = 퍼머링크 보장.
//
// 깨졌다면: 의도한 체계 변경이면 스냅샷 갱신(과거 퍼머링크가 전부 바뀌는
// 배포임을 인지하고), 아니면 사고다 — 원인을 찾아라.

import { describe, expect, it } from 'vitest';
import { cyrb128 } from '../src/core/rng';
import { paramsFor } from '../src/params';

// 정각 / 23:59:59 / 00:00:00 / 월말 / 윤일 / 모드 전환 경계 포함 16개 (§12)
const FIXED_TS = [
  '2026-01-01T00:00:00',
  '2026-01-31T23:59:59',
  '2026-02-01T00:00:00',
  '2026-02-28T12:34:56',
  '2026-04-15T09:15:30',
  '2026-07-30T05:59:59', // ink → paper 직전
  '2026-07-30T06:00:00', // 경계
  '2026-07-30T14:00:00', // 정각
  '2026-07-30T14:23:07',
  '2026-07-30T17:59:59', // paper → ink 직전
  '2026-07-30T18:00:00', // 경계
  '2026-08-31T23:00:00',
  '2026-12-31T23:59:59', // 연말 마지막 초
  '2027-01-01T00:00:00', // 해 넘김
  '2028-02-29T08:30:15', // 윤일
  '2026-07-30T21:37:42',
] as const;

function hashParams(json: string): string {
  return cyrb128(json)
    .map((h) => h.toString(16).padStart(8, '0'))
    .join('');
}

describe('L1 — 파라미터 스냅샷', () => {
  it('고정 타임스탬프 16개의 params 해시가 기록과 일치한다', () => {
    const hashes: Record<string, string> = {};
    for (const ts of FIXED_TS) {
      hashes[ts] = hashParams(JSON.stringify(paramsFor(ts)));
    }
    expect(hashes).toMatchSnapshot();
  });

  it('전체 params JSON도 한 시각은 원문으로 기록한다 (디버깅용 기준선)', () => {
    expect(paramsFor('2026-07-30T14:23:07')).toMatchSnapshot();
  });
});
