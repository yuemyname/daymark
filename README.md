# daymark

날짜를 시드로, 매일 한 장씩 다른 그림이 나오는 정적 사이트.
`2026-07-30`이라는 문자열 하나로부터 완전히 결정되는 그림을 매일 자정(KST)에 바꿔 보여준다.
서버도 DB도 이미지 저장소도 없다 — 그림은 저장되지 않고 날짜로부터 다시 계산된다.

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

dev 서버에서 `/palettes.html` — 팔레트 100개 검수 페이지 (W0.2, 프로덕션 빌드 제외).

## 진행 상황

- [x] W1 결정성 코어 — rng(cyrb128+sfc32), KST 날짜, OKLCH 팔레트(ΔL 가드), params 골격, 시스템 선택(직전 2일 회피), ESLint 결정성 규칙, L1 스냅샷 테스트
- [x] W2 수직 슬라이스 — canvas 헬퍼(유닛 스케일 확정), S4 subdivision, `/` 오늘 화면(캡션+카운트다운), rAF 점진 렌더, 배포 설정(GitHub Pages 워크플로 + Netlify `_redirects`)
  - 미구현 시스템은 subdivision으로 폴백 (W3에서 해소)
  - 배포는 저장소 Settings → Pages → Source를 "GitHub Actions"로 켜야 활성화됨
- [ ] W3 시스템 4종 (truchet / flowfield / interference / packing + dateGlyph)
- [ ] W4 다듬기 — L2 트레이스 테스트, 90일 미리보기, 튜닝, 타이포
- [ ] W5 아카이브
- [ ] W6 상세 + PNG 내보내기
