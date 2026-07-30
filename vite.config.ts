/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
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
