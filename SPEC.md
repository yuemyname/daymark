# SPEC.md — daymark

> 날짜를 시드로, 매일 한 장씩 다른 그림이 나오는 웹페이지.
> *daymark*는 원래 항해용 주간 표지물을 뜻한다. 이름은 마음에 안 들면 바꿔도 된다.

---

## 1. 한 줄 정의

`2026-07-30`이라는 문자열 하나로부터 완전히 결정되는 그림 한 장을, 매일 자정(KST)에 바꿔서 보여주는 정적 사이트.

**서버도 데이터베이스도 이미지 저장소도 없다.** 그림은 저장되는 게 아니라 언제든 날짜로부터 다시 계산된다. 이 성질이 이 프로젝트의 전부이고, 아래 §2의 제약은 전부 이걸 지키기 위한 것이다.

---

## 2. 핵심 제약 — 결정성

### 2.1 시드 파이프라인

```
"2026-07-30"  →  cyrb128 해시 (32bit ×4)  →  sfc32 PRNG  →  파라미터  →  렌더
```

```ts
// src/core/rng.ts
export function cyrb128(str: string): [number, number, number, number] { /* ... */ }
export function sfc32(a: number, b: number, c: number, d: number): () => number { /* ... */ }

export function rngFor(dateKey: string) {
  return sfc32(...cyrb128(dateKey));
}
```

`sfc32`를 쓰는 이유: 주기가 충분히 길고, 상태가 32bit 정수 4개뿐이라 브라우저/런타임에 관계없이 **비트 단위로 동일한 수열**이 나온다. `mulberry32`도 가능하지만 시드 공간이 32bit뿐이라 날짜별 다양성이 아쉽다.

### 2.2 날짜는 KST로 고정한다

사용자의 로컬 타임존을 쓰면 비행기만 타도 그림이 바뀐다. 날짜 키는 항상 서울 기준으로 만든다.

```ts
export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);   // "2026-07-30"
}
```

`en-CA` 로케일이 `YYYY-MM-DD`를 뱉는다. 직접 문자열을 조립하지 말 것 — 서머타임/월말 경계에서 틀린다.

### 2.3 `Math.random` 절대 금지

`src/systems/` 와 `src/params/` 아래에서 `Math.random`을 한 번이라도 부르면 프로젝트의 전제가 무너진다. 그런데 이건 눈으로 못 잡는다. 새로고침해야 티가 나고, 새로고침해도 한 번은 그럴듯해 보이기 때문이다.

**강제 수단 (W1에서 먼저 넣는다):**

```js
// eslint.config.js
{
  files: ['src/systems/**', 'src/params/**'],
  rules: {
    'no-restricted-properties': ['error', {
      object: 'Math', property: 'random',
      message: 'Math.random은 결정성을 깬다. 주입받은 rng()를 써라.',
    }],
    'no-restricted-globals': ['error',
      { name: 'Date', message: 'Date도 결정성을 깬다. dateKey를 인자로 받아라.' },
    ],
  },
}
```

렌더 함수는 `rng`를 **인자로 주입받는다.** 모듈 스코프에 전역 rng를 두면 호출 순서에 따라 결과가 바뀌어서 디버깅이 지옥이 된다.

### 2.4 브라우저 간 픽셀 차이는 허용한다

캔버스의 안티에일리어싱과 폰트 래스터화는 브라우저마다 미세하게 다르다. 이건 못 막고, 막을 필요도 없다.

**보장하는 것:** 같은 날짜 → 같은 파라미터, 같은 도형의 같은 좌표.
**보장하지 않는 것:** 픽셀 단위 동일성.

테스트도 이 경계에 맞춰서 짠다 (§10).

---

## 3. 기술 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| 빌드 | Vite + TypeScript | null8과 동일. 학습 비용 0 |
| 프레임워크 | 없음 (vanilla) | 화면 3개짜리다. 라우팅만 직접 |
| 렌더 | Canvas 2D | WebGL 불필요. 대부분 선/도형 누적 |
| 노이즈 | `simplex-noise` v4 | `createNoise2D(rng)`로 PRNG 주입 가능 |
| 색 | `culori` | OKLCH ↔ sRGB 변환 (§7) |
| 배포 | Netlify | 정적. 빌드 산출물만 올리면 끝 |

의존성은 이 셋으로 끝낸다. 제너러티브 아트 라이브러리(p5 등)를 얹으면 내부에서 `Math.random`을 쓰기 때문에 §2.3과 충돌한다.

---

## 4. 프로젝트 구조

```
src/
  core/
    rng.ts            # cyrb128 + sfc32
    date.ts           # todayKey, 날짜 유효성, 다음 자정까지 남은 시간
    palette.ts        # 시드 → 팔레트
    canvas.ts         # DPR 처리, 유닛 좌표 → 픽셀 변환
  params/
    index.ts          # dateKey → Params (시스템 선택 + 파라미터 확정)
    types.ts
  systems/
    flowfield.ts
    packing.ts
    truchet.ts
    subdivision.ts
    interference.ts
    index.ts          # SystemId → render 함수 레지스트리
  views/
    today.ts
    archive.ts
    plate.ts          # 특정 날짜 상세
  export/
    png.ts            # 고해상도 PNG 내보내기
test/
  determinism.test.ts
```

---

## 5. 3단 분리 — 시드 / 파라미터 / 렌더

렌더 함수가 rng를 직접 뒤지게 하면, 나중에 "왜 이 날은 이렇게 나왔지"를 추적할 수 없다. 중간에 **명시적인 파라미터 객체**를 둔다.

```ts
// params/types.ts
export type Params = {
  dateKey: string;
  system: SystemId;
  palette: Palette;
  seedHex: string;          // 화면에 표시할 시드 지문
  config: SystemConfig;     // 시스템별 파라미터 (아래 §6)
};

// systems/index.ts
export type RenderArgs = {
  ctx: CanvasRenderingContext2D;
  size: number;             // 정사각 한 변 (px)
  params: Params;
  rng: () => number;        // 렌더용으로 새로 만든 rng
};
export type RenderFn = (a: RenderArgs) => void;
```

`params` 산출용 rng와 `render`용 rng는 **분리해서 각각 새로 만든다.** 같은 rng를 이어 쓰면, 파라미터 하나를 추가하는 순간 그 뒤 모든 날의 그림이 전부 바뀐다.

```ts
const paramRng  = rngFor(dateKey + ':params');
const renderRng = rngFor(dateKey + ':render');
```

이 두 줄이 나중에 시스템을 추가할 때 과거 그림을 지켜준다.

### 5.1 시스템 선택 규칙

```ts
// 가중치 추첨 후, 직전 2일과 겹치면 재추첨 (최대 4회)
// 과거 날짜로부터 순수하게 계산되므로 결정성은 유지된다
```

이게 없으면 같은 시스템이 3~4일 연속으로 나오는 날이 생겨서 "매일 새로 나온다"는 느낌이 죽는다.

---

## 6. 시스템 5종

전부 **유닛 좌표계 [0,1]²** 에서 계산하고, 마지막에 `size`를 곱한다 (§8).

### S1. flowfield — 흐름장
심플렉스 노이즈로 만든 각도장을 따라 입자를 흘려서 궤적을 남긴다.

```
config: { noiseScale, particles, steps, stepLen, alpha, taper, turns }
권장:     0.8~3.0   300~1200  40~200  0.002~0.006  0.03~0.12
```
- 입자 시작점은 지터를 준 격자에 배치 (완전 랜덤보다 밀도가 고르다)
- 궤적은 진행할수록 얇아지게(`taper`) 그리면 붓질 느낌이 난다

### S2. packing — 원 채우기
후보 위치를 뽑아 충돌 직전까지 반지름을 키운다.

```
config: { attempts, minR, maxR, padding, style, mask }
style:  'solid' | 'ring' | 'nested' | 'mixed'
mask:   'none' | 'dateGlyph'
```
- `mask: 'dateGlyph'`는 그날의 **일(日) 숫자 글리프 내부에만** 원을 채운다. 날짜가 곧 구도가 되는 배치라, 이 프로젝트에서만 나올 수 있는 그림이다. 마스크는 오프스크린 캔버스에 숫자를 그린 뒤 알파값으로 판정
- 충돌 검사는 공간 격자(cell size = maxR×2)로. 전수 비교하면 원 2,000개에서 버벅인다

### S3. truchet — 트루셰 타일
격자의 각 칸에 방향이 다른 타일을 놓아 연속된 무늬를 만든다.

```
config: { grid, variant, subdivide, weight }
variant: 'arc' | 'diagonal' | 'maze' | 'arcThick'
```
- `subdivide` 확률로 칸을 4분할해 재귀 (다중 스케일이 되면서 훨씬 좋아진다)
- 선 굵기는 칸 크기에 비례해야 분할된 칸에서도 자연스럽다

### S4. subdivision — 재귀 분할
사각형을 비율 `r`로 쪼개며 내려간다.

```
config: { maxDepth, splitBias, minSize, leafMix, gutter }
leafMix: 각 리프의 채움 방식 확률 분포 — solid / hatch / empty / concentric
```
- `splitBias`가 0.5 근처면 몬드리안, 0.2/0.8로 치우치면 로그 스케일 느낌
- `gutter`(칸 사이 여백)를 0으로 두는 날과 넉넉히 주는 날을 섞으면 인상이 확 달라진다

### S5. interference — 간섭 줄무늬
서로 다른 각도·주기의 선 다발을 겹쳐 모아레를 만든다.

```
config: { layers: [{ angle, freq, amp, phase, weight }], blend }
```
- 각 선은 직선이 아니라 사인 합으로 변위를 준다: `offset = Σ ampᵢ·sin(freqᵢ·t + phaseᵢ)`
- 레이어 2~3개면 충분하다. 4개 넘으면 전부 회색 죽이 된다

---

## 7. 팔레트

RGB나 HSL에서 색을 뽑으면 밝기가 들쭉날쭉해서 어떤 날은 그냥 안 예쁘다. **OKLCH**에서 뽑는다 — 명도(L)가 지각적으로 균일해서, 어떤 색조를 뽑아도 대비가 유지된다.

```ts
type Palette = {
  bg: string;
  inks: string[];       // 3~5개
  accent: string;       // UI 크롬에도 쓰인다 (§9)
  mode: 'dark' | 'light' | 'paper';
};
```

**생성 규칙**

1. `mode` 추첨 — paper 40% / light 40% / dark 20%
2. 기저 색조 `h₀` 를 블루·그린 계열 [140°, 270°)에서 추첨 (초록 → 청록 → 파랑)
3. 배색 방식 추첨 — analogous(±30°) / mono(±8°). 차분한 톤 유지를 위해 보색 계열(split-complementary, triad)은 뺀다
4. 각 잉크: 방식이 정한 h, C는 0.04~0.10 (파스텔/차분), L은 mode에 따라 배경과 최소 0.35 이상 벌린다
5. `bg`는 아주 낮은 채도(C < 0.02)로. 배경이 채도를 가지면 잉크가 다 탁해 보인다
6. `accent`는 잉크 중 C가 가장 높은 것

**필수 검증:** 모든 잉크가 배경 대비 ΔL ≥ 0.35. 못 넘기면 L을 조정해서 통과시킨다. 이 가드가 없으면 한 달에 두세 번은 거의 안 보이는 그림이 나온다.

---

## 8. 해상도 독립 렌더링

내보내기(§9.4)를 나중에 붙이려고 하면 전부 다시 짜야 한다. 처음부터 강제한다.

**규칙**

- 모든 좌표·반지름·선 굵기는 **유닛 [0,1] 값으로 계산**하고, 그릴 때만 `× size`
- `ctx.lineWidth = w * size` 형태로. 절대 `ctx.lineWidth = 2` 같은 상수를 쓰지 않는다
- **개수는 스케일하지 않는다.** 입자 수, 격자 칸 수, 원 개수는 구도의 일부다. 4096px로 뽑는다고 입자를 늘리면 다른 그림이 된다

가장 간단한 강제 방법은 렌더 시작에 스케일을 걸어두는 것이다.

```ts
ctx.save();
ctx.scale(size, size);        // 이후 모든 좌표는 [0,1]
ctx.lineWidth = 0.002;        // 유닛 단위 그대로
// ... 렌더 ...
ctx.restore();
```

단, 이러면 `lineWidth`도 같이 스케일되므로 굵기 값이 아주 작아진다. 헷갈리면 스케일을 걸지 말고 `u(v) => v * size` 헬퍼를 쓰는 쪽이 명시적이다. **둘 중 하나를 골라서 5개 시스템 전부 통일할 것.**

---

## 9. 화면

### 9.1 디자인 방향

그림이 색을 전부 담당하므로, **크롬(사이트 UI)은 거의 무채색이어야 한다.** 대신 그날의 `palette.accent` 하나만 크롬에 흘려보낸다 — 링크 밑줄, 포커스 링, 카운트다운 숫자. 사이트 자체도 매일 조금씩 다른 색이 된다.

- 디스플레이 서체: **Fraunces** (variable — `wonk`, `SOFT` 축이 있어서 표정이 있다)
- 유틸리티 서체: **IBM Plex Mono** — 날짜·시드·파라미터는 전부 데이터이므로 모노로 조판한다
- 여백을 크게. 그림 한 장이 주인공이고 나머지는 캡션이다

### 9.2 `/` — 오늘

- 정사각 캔버스 한 장, 화면 중앙. 최대 변 `min(90vw, 720px)`
- 하단에 판(plate) 캡션: `2026-07-30 · FLOWFIELD · a3f1c9`
- 다음 장까지 남은 시간 카운트다운 (KST 자정 기준)
- 로드 시 그림이 **그려지는 과정**을 보여준다. 입자가 흐르고 원이 채워지는 과정 자체가 볼 만하다. 완성본을 툭 띄우지 말 것. `requestAnimationFrame`으로 청크 단위 진행

### 9.3 `/archive` — 아카이브

**달력 그리드로 만든다.** 메이슨리나 무한 스크롤이 아니다. 콘텐츠가 날짜이므로 구조도 날짜여야 한다. 월 단위로 7열, 각 칸이 그날의 썸네일.

- 미래 날짜는 빈 칸 (미리 볼 수 없다)
- 썸네일은 **미리 저장하지 않고 그 자리에서 렌더**한다 (§1)
- 성능: `IntersectionObserver`로 화면에 들어온 칸만 렌더. 썸네일은 128px 고정. 한 번 렌더한 칸은 `ImageBitmap`으로 캐시
- 한 달 31칸을 동기로 렌더하면 메인 스레드가 1초 이상 막힌다. 렌더 큐를 만들어 프레임당 1~2칸씩 처리

### 9.4 `/d/2026-07-30` — 판 상세

- 큰 그림 + 파라미터 전문(JSON, 모노)
- PNG 내보내기: 1024 / 2048 / 4096 선택. 오프스크린 캔버스에 동일 코드로 재렌더 후 `toBlob`
- 4096은 시스템에 따라 수 초 걸린다. 진행 표시 필요

---

## 10. 테스트

픽셀 비교는 하지 않는다 (§2.4). 두 층으로 나눈다.

**L1 — 파라미터 스냅샷**
고정된 날짜 목록(월초/월말/윤일/연말 포함 12개)에 대해 `JSON.stringify(params)`의 해시를 기록해두고 비교한다. 시스템 추가·수정 시 과거 날짜가 안 바뀌는 걸 보장한다.

**L2 — 드로우 콜 트레이스**
`ctx`를 프록시로 감싸 호출된 메서드명과 **소수점 4자리로 반올림한** 인자를 로그로 쌓고, 그 로그의 해시를 비교한다. 렌더러 리팩터링이 결과를 바꿨는지 브라우저 독립적으로 잡을 수 있다.

```ts
const trace: string[] = [];
const proxy = new Proxy(ctx, {
  get(t, k) {
    const v = Reflect.get(t, k);
    if (typeof v !== 'function') return v;
    return (...args) => { trace.push(`${String(k)}(${args.map(r4).join(',')})`); return v.apply(t, args); };
  },
});
```

L2는 W4에서 붙인다. L1은 W1에서 바로 붙인다 — 초반에 없으면 시스템을 추가할 때마다 과거가 소리 없이 깨진다.

---

## 11. 배포

- Netlify. `npm run build` → `dist/` 업로드
- SPA 라우팅이므로 `_redirects`에 `/* /index.html 200`
- 캐시: 해시 붙은 에셋은 immutable, `index.html`은 `no-cache`

---

## 12. 비범위 (v1 제외)

- 계정, 좋아요, 댓글
- 서버 사이드 렌더링, 동적 OG 이미지 (v2 후보 — GitHub Action으로 매일 새벽 다음 날 OG 이미지를 미리 뽑아 커밋)
- 애니메이션 결과물(GIF/MP4) 내보내기
- 사용자가 시드를 직접 입력하는 모드 (날짜라는 제약이 이 프로젝트의 핵심이라 v1에서는 일부러 뺀다)
- 즐겨찾기 (localStorage로 간단히 가능하지만 W6 여유가 있을 때만)
