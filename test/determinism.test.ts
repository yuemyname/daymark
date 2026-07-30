// W1.7 / SPEC §10 L1 — 파라미터 스냅샷.
// 고정 날짜 12개의 params 해시를 스냅샷으로 기록한다.
// 시스템을 추가·수정해도 과거 날짜의 params가 바뀌지 않는 것을 보장한다.
//
// 이 테스트가 깨졌다면 둘 중 하나다:
//   1) 의도한 파라미터 체계 변경 → 스냅샷을 갱신하고 커밋 메시지에 명시한다.
//   2) 의도하지 않은 변경 → 과거 아카이브가 전부 바뀌는 사고다. 원인을 찾아라.

import { describe, expect, it } from 'vitest';
import { cyrb128 } from '../src/core/rng';
import { paramsFor } from '../src/params';

// 월초 / 월말 / 윤일 / 연말 경계를 포함한 12개
const FIXED_DATES = [
  '2026-01-01', // 연초 (EPOCH)
  '2026-01-31', // 월말
  '2026-02-01', // 월초
  '2026-02-28', // 평년 2월 말
  '2026-06-15',
  '2026-07-30',
  '2026-08-31',
  '2026-10-05',
  '2026-11-30',
  '2026-12-31', // 연말
  '2027-01-01', // 해 넘김
  '2028-02-29', // 윤일
] as const;

function hashParams(json: string): string {
  return cyrb128(json)
    .map((h) => h.toString(16).padStart(8, '0'))
    .join('');
}

describe('L1 — 파라미터 스냅샷', () => {
  it('고정 날짜 12개의 params 해시가 기록과 일치한다', () => {
    const hashes: Record<string, string> = {};
    for (const key of FIXED_DATES) {
      hashes[key] = hashParams(JSON.stringify(paramsFor(key)));
    }
    expect(hashes).toMatchSnapshot();
  });

  it('전체 params JSON도 한 날짜는 원문으로 기록한다 (디버깅용 기준선)', () => {
    expect(paramsFor('2026-07-30')).toMatchSnapshot();
  });
});
