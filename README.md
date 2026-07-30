# daymark

시각을 시드로, **매초** 다시 계산되는 흑백 그림 한 장. 그 위에 원형 시계가 놓인다.
`2026-07-30T14:23:07`(KST) 문자열 하나로부터 그림이 완전히 결정된다 —
서버도 DB도 이미지 저장소도 없다.

```
필드(field)   →   톤(tone)    →   이펙트(effect)   →   시계(clockface)
회색조 밀도맵      전처리+가드      흑백 마크 렌더        눈금+바늘 (60fps)
```

- 설계: [SPEC.md](./SPEC.md) · 작업 계획: [WBS.md](./WBS.md)
- 계층 시드: 시(종류) / 분(구조) / 초(위상만, rng 없음) — 매초 변하되 매초 무너지지 않는다
- 톤 모드는 추첨하지 않는다: 06~18시 paper(흰 바탕), 18~06시 ink(검은 바탕), 경계 8분 크로스페이드

## 개발

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # L1 파라미터 스냅샷 + L2 트레이스 + L3 성능 회귀 포함
npm run lint       # fields/·effects/·params/에서 Math.random·Date·performance 금지
npm run build      # lint + tsc + vite build
```

dev 서버 전용(프로덕션 빌드 제외): `/ticks.html` — 1분치 60장 + 1시간치 60장 미리보기 (`?m=YYYY-MM-DDTHH:mm`)

## 화면

- `#/` — 지금. 배경 1Hz + 바늘 60Hz(캔버스 2장), 저전력 토글(`prefers-reduced-motion` 연동)
- `#/t/2026-07-30T14:23:07` — 판 상세 퍼머링크. 파라미터 JSON, 시계 토글, PNG 1024/2048/4096

## 진행 상황 (v1)

- [x] W1 결정성 코어 — rng, KST 시각(time/clock), 계층 시드, 톤+밀도 가드, ESLint 규칙, L1
- [x] W2 수직 슬라이스 — 필드 버퍼 파이프라인, 캔버스 2장(1Hz/60Hz), 시계 얼굴, L3 성능 테스트
- [x] W3 필드 5종 (noise / radial★handInfluence / interference / subdivision / flow) + 이펙트 4종 (dots / dither / stipple / steps) + 궁합 가중치
- [x] W4 — 60틱 미리보기(`/ticks.html`), L2 트레이스 스냅샷(20조합)
- [x] W5 — 판 상세 퍼머링크, PNG 내보내기(시계 포함/미포함), 저전력 모드
- [ ] v1.1 — 이펙트 E5~E8 (edge / displace / automata / ascii)

배포: GitHub Pages 워크플로 포함 (Settings → Pages → Source: GitHub Actions 활성화 필요).
