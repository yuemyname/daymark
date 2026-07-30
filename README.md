# daymark

시각을 시드로, **매분** 한 장씩 다른 그림이 나오는 정적 사이트.
`2026-07-30 21:37`(KST)이라는 문자열 하나로부터 완전히 결정되는 그림을 분이 바뀔 때마다 보여준다.
서버도 DB도 이미지 저장소도 없다 — 그림은 저장되지 않고 판 키로부터 다시 계산된다.

- 설계: [SPEC.md](./SPEC.md)
- 작업 계획: [WBS.md](./WBS.md)

## 개발

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # 유닛 + L1 결정성 테스트
npm run lint       # 결정성 규칙 포함 (systems/, params/에서 Math.random·Date 금지)
npm run build      # lint + tsc + vite build
```

dev 서버 전용 페이지 (프로덕션 빌드 제외):

- `/palettes.html` — 팔레트 100개 검수 (W0.2)
- `/plates.html` — 연속 24분의 판 미리보기, `?start=YYYY-MM-DDTHH:mm`으로 시작 지정

## 진행 상황

- [x] W1 결정성 코어 — rng(cyrb128+sfc32), KST 날짜, OKLCH 팔레트(ΔL 가드), params 골격, 시스템 선택(직전 2일 회피), ESLint 결정성 규칙, L1 스냅샷 테스트
- [x] W2 수직 슬라이스 — canvas 헬퍼(유닛 스케일 확정), S4 subdivision, `/` 오늘 화면(캡션+카운트다운), rAF 점진 렌더, 배포 설정(GitHub Pages 워크플로 + Netlify `_redirects`)
  - 배포는 저장소 Settings → Pages → Source를 "GitHub Actions"로 켜야 활성화됨
- [x] 주기 변경 — 하루 → 1분 (판 키 `YYYY-MM-DD HH:mm`, KST). 시스템 선택은 직전 2분 회피(O(1) 원추첨 방식)
- [x] W3 시스템 4종 (truchet / flowfield / interference / packing + dateGlyph)
  - 아카이브(W5)는 하루 1,440장 체제에 맞는 재설계 필요
- [ ] W4 다듬기 — L2 트레이스 테스트, 90일 미리보기, 튜닝, 타이포
- [ ] W5 아카이브
- [ ] W6 상세 + PNG 내보내기
