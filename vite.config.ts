/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 base — GitHub Pages(/daymark/ 하위 경로)와 Netlify 어디서든 동작한다.
  // SPA 딥링크 라우팅(W5.4)을 붙일 때 재검토할 것.
  base: './',
  // 프로덕션 빌드 입력은 index.html뿐.
  // palettes.html(W0.2 검수 페이지)은 dev 서버에서만 접근한다.
  build: {
    rollupOptions: {
      input: 'index.html',
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
