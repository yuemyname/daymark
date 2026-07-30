# SPEC.md — daymark

> 시각을 시드로, 매초 다시 계산되는 흑백 그림 한 장. 그 위에 원형 시계가 놓인다.
> *daymark*는 원래 항해용 주간 표지물을 뜻한다. 이름은 마음에 안 들면 바꿔도 된다.

---

## 1. 한 줄 정의

`2026-07-30T14:23:07`이라는 문자열 하나로부터 완전히 결정되는 **흑백** 그림 한 장을, 초침이 움직일 때마다 다시 계산해서 원형 시계의 배경으로 보여주는 정적 사이트.

**서버도 데이터베이스도 이미지 저장소도 없다.** 그림은 저장되는 게 아니라 언제든 타임스탬프로부터 다시 계산된다.

그림은 두 단계로 만든다.

```
필드(field)  →  이펙트(effect)
회색조 밀도맵     그 밀도를 흑백 마크로 옮기는 렌더러
```

**이게 v1에서 가장 중요한 구조 변경이다.** tooooools.app의 이펙트(하프톤, 디더링, 스티플링, ASCII…)는 전부 *입력 이미지를 받아 변환하는* 후처리다. 원본이 없으면 아무것도 못 그린다. 그래서 원래 스펙의 시스템 5종은 "그림"이 아니라 **이펙트에 먹일 회색조 원본**을 만드는 역할로 내려가고, 최종 화면은 이펙트가 그린다.

색은 없다. 계조는 오직 **마크의 밀도와 크기**로만 표현한다 (§8).

---

## 2. 핵심 제약 — 결정성

### 2.1 시드 파이프라인

```
"2026-07-30T14:23:07"  →  cyrb128 (32bit ×4)  →  sfc32 PRNG  →  파라미터  →  필드  →  이펙트
```

```ts
// src/core/rng.ts
export function cyrb128(str: string): [number, number, number, number] { /* ... */ }
export function sfc32(a: number, b: number, c: number, d: number): () => number { /* ... */ }
export function rngFor(key: string) { return sfc32(...cyrb128(key)); }
```

`sfc32`를 쓰는 이유는 그대로다. 상태가 32bit 정수 4개뿐이라 브라우저/런타임에 관계없이 비트 단위로 동일한 수열이 나온다.

### 2.2 시각은 KST로 고정한다

```ts
// src/core/time.ts
const FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});

/** "2026-07-30T14:23:07" */
export function tsKey(now: Date): string {
  return FMT.format(now).replace(' ', 'T');
}
export function hourKey(ts: string)   { return ts.slice(0, 13); } // "2026-07-30T14"
export function minuteKey(ts: string) { return ts.slice(0, 16); } // "2026-07-30T14:23"
export function secondOf(ts: string)  { return +ts.slice(17, 19); }
```

`sv-SE` 로케일이 `YYYY-MM-DD HH:mm:ss`를 뱉는다. 직접 조립하지 말 것.

### 2.3 계층 시드 — 초마다 전부 다시 뽑지 않는다

**매초 rng를 새로 뽑으면 스트로브가 된다.** 연속한 두 프레임이 완전히 무상관이라 화면이 1Hz로 번쩍인다. 30초만 보고 있어도 눈이 아프고, 시계로는 쓸 수 없다.

바뀌는 속도를 계층으로 나눈다.

| 계층 | 시드 키 | 바뀌는 것 | 주기 |
|---|---|---|---|
| 시(hour) | `hourKey + ':pick'` | 필드 종류, 이펙트 종류, 톤 모드 | 1시간 |
| 분(minute) | `minuteKey + ':config'` | 구조 파라미터 — 그리드 수, 레이어 수, 기준 각도, 임계값 | 1분 |
| 초(second) | *(rng 없음)* | 위상 φ = s/60 을 **연속값으로** 주입 | 매초 |

**규칙: rng 재추첨은 분까지만. 초는 연속 위상으로만 들어간다.**

이러면 1분 동안은 같은 구도가 초침을 따라 흘러가고, 분이 바뀔 때 구조가 갈아엎이고, 시가 바뀔 때 그림의 종류 자체가 바뀐다. "매초 변하되 매초 무너지지는 않는" 상태가 된다.

예외는 §7의 `automata` 하나다. 이건 초 자체가 세대 수라서 매초 상태가 진행된다 — 그게 이 이펙트를 쓰는 이유다.

```ts
const pickRng   = rngFor(hourKey(ts) + ':pick');
const cfgRng    = rngFor(minuteKey(ts) + ':config');
const phase     = secondOf(ts) / 60;        // [0, 1)
```

세 개의 rng를 **분리해서 각각 새로 만든다.** 이어 쓰면 파라미터 하나를 추가하는 순간 그 뒤 모든 시각의 그림이 전부 바뀐다.

### 2.4 `Math.random`과 `Date` 금지

`src/fields/`, `src/effects/`, `src/params/` 아래에서 둘 다 금지한다. 시각은 언제나 인자로 주입받는다.

```js
// eslint.config.js
{
  files: ['src/fields/**', 'src/effects/**', 'src/params/**'],
  rules: {
    'no-restricted-properties': ['error', {
      object: 'Math', property: 'random',
      message: 'Math.random은 결정성을 깬다. 주입받은 rng()를 써라.',
    }],
    'no-restricted-globals': ['error',
      { name: 'Date', message: 'Date도 결정성을 깬다. ts를 인자로 받아라.' },
      { name: 'performance', message: '렌더 결과가 시계에 의존하면 안 된다.' },
    ],
  },
}
```

시각을 읽는 곳은 `core/clock.ts` **한 군데뿐이다.** 여기서 틱을 만들어 아래로 흘려보낸다.

### 2.5 브라우저 간 픽셀 차이는 허용한다

**보장하는 것:** 같은 타임스탬프 → 같은 파라미터, 같은 마크의 같은 좌표.
**보장하지 않는 것:** 픽셀 단위 동일성.

테스트도 이 경계에 맞춘다 (§12).

---

## 3. 기술 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| 빌드 | Vite + TypeScript | null8과 동일. 학습 비용 0 |
| 프레임워크 | 없음 (vanilla) | 화면 2개짜리다 |
| 렌더 | Canvas 2D ×2장 | §10. WebGL 불필요 |
| 노이즈 | `simplex-noise` v4 | `createNoise2D(rng)`로 PRNG 주입 가능 |
| 색 | **없음** | ~~culori~~ — 흑백이므로 색 라이브러리가 통째로 빠진다 |
| 배포 | Netlify | 정적 |

의존성은 `simplex-noise` 하나로 끝난다. p5 등 제너러티브 라이브러리는 내부에서 `Math.random`을 쓰므로 §2.4와 충돌한다.

---

## 4. 프로젝트 구조

```
src/
  core/
    rng.ts            # cyrb128 + sfc32
    time.ts           # tsKey / hourKey / minuteKey, KST 고정
    clock.ts          # 틱 소스 (Date를 읽는 유일한 파일)
    tone.ts           # 전처리 체인 + 잉크 모드 (§8)
    canvas.ts         # DPR, 유닛 좌표 → 픽셀
    sampler.ts        # ImageData → 이중선형 lum(x, y)
  params/
    index.ts          # ts → Params
    types.ts
  fields/             # ← 구 systems/. 회색조 원본을 만든다
    noise.ts
    radial.ts
    interference.ts
    subdivision.ts
    flow.ts
    index.ts
  effects/            # ← tooooools 계열. 회색조를 흑백 마크로 옮긴다
    dots.ts
    dither.ts
    stipple.ts
    steps.ts
    edge.ts
    displace.ts
    automata.ts
    ascii.ts
    index.ts
  clockface/
    draw.ts           # 눈금 + 바늘
  views/
    now.ts
    plate.ts          # /t/:timestamp
  export/
    png.ts
test/
  determinism.test.ts
  perf.test.ts
```

---

## 5. 4단 분리 — 시드 / 파라미터 / 필드 / 이펙트

```ts
// params/types.ts
export type Params = {
  ts: string;
  field: FieldId;
  effect: EffectId;
  tone: Tone;               // §8
  seedHex: string;          // 화면에 표시할 지문
  fieldConfig: FieldConfig;
  effectConfig: EffectConfig;
  phase: number;            // [0,1) 초 위상
};
```

```ts
// fields/index.ts — 저해상 오프스크린에 회색조를 그린다
export type FieldArgs = {
  ctx: OffscreenCanvasRenderingContext2D;
  res: number;              // 항상 512
  params: Params;
  rng: () => number;
};
export type FieldFn = (a: FieldArgs) => void;

// effects/index.ts — 회색조를 샘플링해서 최종 캔버스에 그린다
export type EffectArgs = {
  ctx: CanvasRenderingContext2D;
  size: number;             // 정사각 한 변 (px)
  lum: (x: number, y: number) => number;   // [0,1]² → [0,1] 이중선형
  params: Params;
  rng: () => number;
};
export type EffectFn = (a: EffectArgs) => void;
```

**필드 해상도는 512로 고정한다.** 출력이 4096이어도 필드는 512다. 필드 비용이 출력 크기와 무관해지고, 무엇보다 4096에서 마크 개수가 늘어나 다른 그림이 되는 걸 막는다 (§9).

### 5.1 조합 선택 규칙

```ts
// 이펙트를 가중치 추첨 → 직전 2시간과 겹치면 재추첨 (최대 4회)
// 필드는 이펙트별 궁합 가중치로 추첨 (§7 표)
// 과거 시각으로부터 순수하게 계산되므로 결정성은 유지된다
```

필드×이펙트가 45조합인데 전부 좋지는 않다. 예를 들어 `subdivision × dither`는 그냥 격자 무늬가 되고, `noise × ascii`는 글자 죽이 된다. 궁합표로 가중치를 준다 (§7).

---

## 6. 필드 5종

전부 **유닛 좌표계 [0,1]²** 에서 계산하고 512×512 오프스크린에 회색조로 그린다. `phase`는 위상·각도에만 들어간다 — 구조를 바꾸는 데 쓰면 초마다 튄다.

### F1. noise — 심플렉스 노이즈
```
config: { scale, octaves, warp, ridged }
권장:     1.5~6.0   1~3      0~0.4
```
- 도메인 워핑(`warp`)을 주면 대리석/등고선 느낌이 난다
- `phase`는 3번째 축으로: `noise3(x, y, phase)` — 1분 주기로 매끄럽게 순환한다

### F2. radial — 시계 기하 ★
중심에서 뻗는 방사·동심원. **바늘 각도가 그대로 들어간다.**
```
config: { rings, spokes, twist, falloff, handInfluence }
```
- `handInfluence`가 이 프로젝트의 시그니처다. 초침/분침/시침 각도를 각각 가우시안 로브로 밀도에 더한다 — 그림이 곧 시각의 도해가 된다
- 시계 눈금(§11)과 주기가 맞아떨어지면 뻔해진다. `rings`는 12·60의 배수를 피할 것

### F3. interference — 간섭 줄무늬
서로 다른 각도·주기의 사인 다발을 겹쳐 모아레를 만든다.
```
config: { layers: [{ angle, freq, amp, phaseOffset }], blend }
```
- 레이어 2~3개. 4개 넘으면 전부 회색 죽이 된다
- `phase`를 각 레이어에 다른 배속으로 넣으면 무늬가 천천히 미끄러진다. 배속 차가 크면 어지럽다 — 0.5×~1.5× 안에서

### F4. subdivision — 재귀 분할
사각형을 비율 `r`로 쪼개며 내려가고, 각 리프에 회색값을 채운다.
```
config: { maxDepth, splitBias, minSize, gutter }
```
- `splitBias` 0.5 근처면 몬드리안, 0.2/0.8로 치우치면 로그 스케일
- **`phase`를 안 쓰는 유일한 필드다.** 1분간 완전히 정지한다. 전부 움직이면 정신없어서 정지 카드가 하나는 필요하다

### F5. flow — 흐름장
노이즈 각도장을 따라 입자를 흘려 밀도를 누적한다.
```
config: { noiseScale, particles, steps, stepLen, decay }
권장:     0.8~3.0   200~600  40~120  0.002~0.006
```
- 512 필드에서만 돌므로 입자 수를 원래 스펙(1200)보다 줄여도 된다. 어차피 이펙트가 다시 마크로 옮긴다
- 매 틱 처음부터 다시 도는 게 가장 비싼 필드다. §13 예산에서 제일 먼저 걸린다

---

## 7. 이펙트 8종 (tooooools 대응)

전부 흑백. 색 파라미터는 없다.

| ID | tooooools | 주요 파라미터 | 궁합 좋은 필드 |
|---|---|---|---|
| **E1 dots** | dots (halftone) | `grid, angle, gridType(regular\|benday), minR, maxR, cornerRadius` | F1, F2, F5 |
| **E2 dither** | dithering | `pattern(bayer2\|bayer4\|bayer8\|fs), pixelSize, threshold` | F1, F3, F5 |
| **E3 stipple** | stippling | `xSquares, ySquares, angle, minW, maxW` | F2, F4 |
| **E4 steps** | gradients | `stepSize, shape(rect\|ellipse), levels` | F3, F4 |
| **E5 edge** | edge | `threshold, minR, maxR, stepSize` | F1, F4, F5 |
| **E6 displace** | displace | `stepSize, displacement, dotSize` | F1, F2, F3 |
| **E7 automata** | cellular automata | `cellSize, survive[2], birth[2], type` | F1, F4 |
| **E8 ascii** | ASCII | `cols, rows, charset` | F2, F4 |

**v1은 E1·E2·E3·E4 네 종만 만든다.** 나머지는 W3에서 붙인다 (WBS 참조).

### 7.1 automata의 초 진행

이것만 `phase`가 아니라 **초를 세대 수로** 쓴다.

```
초기 상태 = minuteKey로 만든 필드를 threshold로 이진화
현재 상태 = 초기 상태에서 (s + 1)세대 진행
```

새로고침해도 같은 결과가 나온다 (순수하게 타임스탬프의 함수다). 대신 s=59에서 60세대를 처음부터 돌아야 하므로 비용이 초에 비례한다. `cellSize ≥ 4` (즉 128² 이하 격자)로 상한을 걸고, §13 예산을 넘으면 세대를 스킵하지 말고 `cellSize`를 키운다 — 스킵하면 결정성이 깨진다.

### 7.2 제외한 tooooools 이펙트

| 제외 | 이유 |
|---|---|
| recolor | 컬러 전용. §8과 정면 충돌 |
| patterns, distort | 외부 이미지(패턴/디스토션 맵) 업로드가 전제. 이 프로젝트엔 업로드가 없다 |
| scatter | Lloyd relaxation이 틱 예산을 못 맞춘다. 1024점 relax 20회면 iPad에서 300ms 넘는다 |
| CRT | 스캔라인·블룸만 쓰면 흑백에서도 되지만, 나머지 이펙트 위에 얹는 **후처리**라 성격이 다르다. v2에 `post` 레이어로 따로 |
| bevel | 흑백에서 가능하고 싸다. 시간 남으면 E9로 |

---

## 8. 톤 — 팔레트 대체

색은 없다. `Palette`를 통째로 지우고 `Tone`으로 바꾼다.

```ts
export type Tone = {
  mode: 'paper' | 'ink';   // paper: 흰 배경 검은 잉크 / ink: 그 반대
  blur: number;            // 0 ~ 0.02  (유닛)
  grain: number;           // 0 ~ 0.15
  gamma: number;           // 0.5 ~ 2.2
  blackPoint: number;      // 0 ~ 0.35
  whitePoint: number;      // 0.65 ~ 1
};
```

전처리 체인은 tooooools의 Image Preprocessing 패널을 그대로 가져온다: **blur → grain → gamma → black/white point.** 필드 ImageData에 한 번 적용하고, 이펙트는 그 결과만 본다.

**모드는 추첨하지 않는다.** 시각의 함수로 고정한다.

```
06:00 ~ 17:59 → paper
18:00 ~ 05:59 → ink
```

밤에 흰 화면이 켜지는 건 시계로서 최악이고, 이걸 rng로 뽑으면 어떤 날은 새벽 3시에 흰 화면이 된다. 경계에서 8분간 크로스페이드한다.

**필수 검증 — 밀도 가드:** 전처리 후 필드의 평균 밀도가 **0.30 ~ 0.55** 안에 들어와야 한다. 벗어나면 `blackPoint`/`whitePoint`를 자동 조정해서 통과시킨다.

이게 구 스펙의 ΔL 가드를 대신한다. 없으면 하루에 몇 번씩 새까맣거나 텅 빈 화면이 나오고, 그 위의 시계 바늘이 안 보인다.

---

## 9. 해상도 독립 렌더링

- 모든 좌표·반지름·선 굵기는 **유닛 [0,1] 값으로 계산**하고 그릴 때만 `× size`
- `ctx.lineWidth = 2` 같은 픽셀 상수 금지
- **마크 개수는 스케일하지 않는다.** 하프톤 격자 수, 디더 픽셀 크기, ASCII 열 수는 구도의 일부다
- 필드 해상도도 스케일하지 않는다 — 항상 512 (§5)

`u(v) => v * size` 헬퍼를 쓰는 쪽과 `ctx.scale(size, size)`를 거는 쪽 중 **하나를 골라 8종 전부 통일할 것.** 섞이면 4096 내보내기에서 값을 치른다.

디더링만 예외다. `pixelSize`는 유닛이 아니라 **출력 픽셀 기준**이어야 디더 패턴이 뭉개지지 않는다. 4096에서는 `pixelSize × (size / 1024)`로 비례시킨다 — 이 한 줄을 `effects/dither.ts` 주석에 남길 것.

---

## 10. 캔버스 2장

배경과 시계를 한 캔버스에 그리면 둘 중 하나를 못 살린다. 배경을 60fps로 다시 그리면 iPad가 뜨거워지고, 바늘을 1fps로 그리면 초침이 뚝뚝 끊긴다.

```
<canvas id="field">   배경 — 1Hz, 초 경계에서만 다시 그림
<canvas id="face">    시계 — 60Hz(rAF), 눈금 + 바늘만
```

- 두 캔버스를 겹치고 `#face`는 `pointer-events: none`
- `#field`는 원형 클립(`arc` + `clip`) 안에만 그린다. 원 밖은 배경색
- `#face`는 매 프레임 전체 클리어 — 어차피 바늘 3개와 눈금뿐이라 1ms 안 걸린다

### 10.1 바늘 가독성

배경 밀도가 어떻든 바늘이 보여야 한다. 두 겹으로 보장한다.

1. `ctx.globalCompositeOperation = 'difference'`로 바늘을 그린다 — 검은 배경 위에서는 희게, 흰 배경 위에서는 검게 나온다
2. 바늘 외곽에 폭 `0.004` 의 여백을 `destination-out`으로 먼저 파낸다

`difference`만 쓰면 중간 회색(0.5) 배경에서 바늘도 회색이 되어 사라진다. 여백이 그 케이스를 잡는다. **둘 중 하나만 하면 안 된다.**

---

## 11. 화면

### 11.1 디자인 방향

- 화면 전체가 흑백이다. 크롬에 색을 쓰지 않는다. 강조는 굵기와 여백으로만
- 디스플레이 서체: **Fraunces** (variable — `wonk`, `SOFT` 축)
- 유틸리티 서체: **IBM Plex Mono** — 시각·시드·파라미터는 전부 데이터이므로 모노로. E8(ASCII)도 같은 서체를 쓴다
- 여백을 크게. 시계가 주인공이고 나머지는 캡션이다

### 11.2 `/` — 지금

- 원형 시계 한 장, 화면 중앙. 지름 `min(90vw, 90vh, 720px)`
- 눈금: 12개 굵게 + 60개 가늘게. 숫자는 없다 (배경이 이미 복잡하다)
- 바늘 3개. 초침은 부드럽게 스윕(rAF), 배경은 초 경계에서 갱신 — 둘의 리듬이 어긋나는 게 오히려 좋다
- 하단 캡션(모노): `14:23:07 · RADIAL / DOTS · a3f1c9`
- **로드 시 배경을 점진적으로 그리지 않는다.** 구 스펙의 rAF 청크 연출은 여기서 버린다. 1초마다 갱신되는 화면에서 매번 "그려지는 과정"을 보여주면 영원히 완성되지 않는 화면이 된다
- 저전력 토글: 켜면 배경이 **분 단위**로만 갱신된다. `prefers-reduced-motion`이면 기본 켜짐

### 11.3 `/t/2026-07-30T14:23:07` — 판 상세

- 그 순간의 큰 그림 + 파라미터 전문(JSON, 모노). 시계는 정지 상태로 겹쳐 보여준다
- PNG 내보내기: 1024 / 2048 / 4096. 오프스크린에 동일 코드로 재렌더 후 `toBlob`
- 시계 포함/미포함 토글
- 공유 가능한 퍼머링크다. "이 순간"을 저장하는 유일한 수단

### 11.4 아카이브는 만들지 않는다

원래 스펙의 달력 아카이브(§9.3)는 **삭제한다.** 하루에 86,400장이 나오는 대상에 달력 썸네일은 의미가 없다 — 한 칸이 그날의 무엇을 대표하는지 정의할 수가 없다.

대신 §11.3의 퍼머링크와, 개발용 60틱 미리보기(WBS W4.2)로 대체한다.

---

## 12. 테스트

픽셀 비교는 하지 않는다 (§2.5). 세 층으로 나눈다.

**L1 — 파라미터 스냅샷**
고정 타임스탬프 16개(정각, `23:59:59`, `00:00:00`, 월말, 윤일, 모드 전환 경계 `05:59:59`/`06:00:00` 포함)에 대해 `JSON.stringify(params)`의 해시를 기록해두고 비교한다.

**L2 — 드로우 콜 트레이스**
`ctx`를 프록시로 감싸 메서드명과 **소수점 4자리로 반올림한** 인자를 로그로 쌓고 해시를 비교한다.

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

**L3 — 성능 회귀 (신규)**
필드 5 × 이펙트 8 = 40조합을 `size=720`으로 각 10회 렌더해 중앙값을 기록한다. §13 예산을 넘으면 실패시킨다. 매초 도는 렌더러에서 이 테스트가 없으면 성능은 반드시 조용히 무너진다.

L1과 L3은 W1~W2에서 바로 붙인다. L2는 W4.

---

## 13. 성능 예산

매초 도는 화면이라 이게 스펙의 일부다.

| 항목 | 예산 (iPad Safari 기준) |
|---|---|
| 필드 512² 생성 | ≤ 40ms |
| 전처리 체인 | ≤ 10ms |
| 이펙트 렌더 (720px) | ≤ 80ms |
| **틱 총합** | **≤ 130ms (p95 200ms)** |
| 시계 레이어 1프레임 | ≤ 2ms |

**필수 사항**

- `document.hidden`이면 틱을 완전히 정지한다. 백그라운드 탭에서 계속 도는 시계는 배터리 먹는 벌레다
- 틱은 `setInterval(1000)`이 아니라 **다음 초 경계까지의 잔여 시간으로 `setTimeout`을 재설정**한다. `setInterval`은 드리프트가 쌓여 초침과 배경이 어긋난다
- 한 틱이 예산을 넘기면 그 틱은 **건너뛴다.** 큐에 쌓아 밀리면 시각과 그림이 어긋나고, 그 순간 이 프로젝트의 전제가 깨진다
- 오프스크린 캔버스와 ImageData 버퍼는 **한 번 만들어 재사용한다.** 초당 한 번 512² 버퍼를 새로 할당하면 GC가 주기적으로 프레임을 잡아먹는다

---

## 14. 배포

- Netlify. `npm run build` → `dist/`
- SPA 라우팅이므로 `_redirects`에 `/* /index.html 200`
- 캐시: 해시 붙은 에셋은 immutable, `index.html`은 `no-cache`

---

## 15. 비범위 (v1 제외)

- **색** — 이 프로젝트의 전제다
- **달력 아카이브** — §11.4
- 계정, 좋아요, 댓글
- SSR, 동적 OG 이미지
- 애니메이션 결과물(GIF/MP4) 내보내기
- 사용자가 시각을 직접 입력하는 모드 (퍼머링크로 대체)
- CRT/bevel 후처리 레이어 (v2)
- 알람·타이머 등 실제 시계 기능 — 이건 시계처럼 생긴 그림이지 시계가 아니다
