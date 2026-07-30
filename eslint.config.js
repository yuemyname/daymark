// SPEC §2.4 — 결정성 강제.
// fields/ · effects/ · params/ 안에서 Math.random / Date / performance 를 쓰면
// lint(=build)가 실패한다. 시각을 읽는 곳은 core/clock.ts 한 군데뿐이다.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/fields/**', 'src/effects/**', 'src/params/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random은 결정성을 깬다. 주입받은 rng()를 써라.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Date도 결정성을 깬다. ts를 인자로 받아라.' },
        { name: 'performance', message: '렌더 결과가 시계에 의존하면 안 된다.' },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
);
