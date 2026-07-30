// SPEC §10 L2 — ctx 프록시. 호출 메서드명과 소수점 4자리 반올림 인자를 기록한다.
// 실제 캔버스 없이도 드로우 콜 시퀀스를 브라우저 독립적으로 비교할 수 있다.

export function makeTraceCtx(): { ctx: CanvasRenderingContext2D; trace: string[] } {
  const trace: string[] = [];
  const fmt = (v: unknown): string => (typeof v === 'number' ? v.toFixed(4) : String(v));
  const ctx = new Proxy(
    {},
    {
      get(_t, k) {
        return (...args: unknown[]) => {
          trace.push(`${String(k)}(${args.map(fmt).join(',')})`);
        };
      },
      set(_t, k, v) {
        trace.push(`set ${String(k)}=${fmt(v)}`);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, trace };
}
