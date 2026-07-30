// 필드 5종 — 버퍼 결정성과 계층 시드 동작.
// 필드는 캔버스를 안 거치므로 값이 비트 단위로 비교 가능하다.

import { describe, expect, it } from 'vitest';
import { rngFor } from '../src/core/rng';
import { minuteKey } from '../src/core/time';
import { FIELD_RES, fields } from '../src/fields';
import { fieldConfigFor } from '../src/params';
import { FIELD_IDS, type FieldId, type Params } from '../src/params/types';

const RES = 128; // 테스트는 저해상으로 (동작은 동일)

function fakeParams(field: FieldId, ts: string, phase: number): Params {
  return {
    ts,
    field,
    effect: 'dots',
    tone: { mode: 'paper', blur: 0, grain: 0, gamma: 1, blackPoint: 0, whitePoint: 1 },
    seedHex: '000000',
    fieldConfig: fieldConfigFor(field, rngFor(minuteKey(ts) + ':config')),
    effectConfig: {
      kind: 'dots',
      grid: 24,
      angle: 0,
      gridType: 'regular',
      minR: 0.05,
      maxR: 0.5,
      cornerRadius: 1,
    },
    phase,
  };
}

function renderBuf(field: FieldId, ts: string, phase: number): Float32Array {
  const buf = new Float32Array(RES * RES);
  fields[field]({ buf, res: RES, params: fakeParams(field, ts, phase), rng: rngFor(minuteKey(ts) + ':field') });
  return buf;
}

function bufHash(buf: Float32Array): number {
  let h = 0;
  for (let i = 0; i < buf.length; i++) {
    h = (Math.imul(h, 31) + Math.round((buf[i] ?? 0) * 1e6)) | 0;
  }
  return h;
}

describe.each(FIELD_IDS)('%s', (field) => {
  const ts = '2026-07-30T14:23:07';

  it('같은 ts → 버퍼가 비트 단위로 같다', () => {
    expect(bufHash(renderBuf(field, ts, 7 / 60))).toBe(bufHash(renderBuf(field, ts, 7 / 60)));
  });

  it('값이 전부 [0,1] 안에 있고 상수 벌판이 아니다', () => {
    const buf = renderBuf(field, ts, 7 / 60);
    let min = Infinity;
    let max = -Infinity;
    for (const v of buf) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
    expect(max - min).toBeGreaterThan(0.1);
  });

  it('다른 분 → 다른 버퍼 (분 단위 재추첨)', () => {
    expect(bufHash(renderBuf(field, '2026-07-30T14:23:07', 7 / 60))).not.toBe(
      bufHash(renderBuf(field, '2026-07-30T14:41:07', 7 / 60)),
    );
  });
});

describe('phase 규칙 (SPEC §6)', () => {
  it('subdivision은 phase를 안 쓴다 — 1분간 정지', () => {
    expect(bufHash(renderBuf('subdivision', '2026-07-30T14:23:07', 7 / 60))).toBe(
      bufHash(renderBuf('subdivision', '2026-07-30T14:23:41', 41 / 60)),
    );
  });

  it('noise는 phase에 반응한다', () => {
    expect(bufHash(renderBuf('noise', '2026-07-30T14:23:07', 7 / 60))).not.toBe(
      bufHash(renderBuf('noise', '2026-07-30T14:23:41', 41 / 60)),
    );
  });

  it('radial은 초에 반응한다 (바늘 로브)', () => {
    expect(bufHash(renderBuf('radial', '2026-07-30T14:23:07', 7 / 60))).not.toBe(
      bufHash(renderBuf('radial', '2026-07-30T14:23:41', 41 / 60)),
    );
  });
});

describe('FIELD_RES', () => {
  it('512 고정 (§5 — 출력 크기와 무관)', () => {
    expect(FIELD_RES).toBe(512);
  });
});
