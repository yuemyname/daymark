// SPEC §2.3 — 결정성 강제.
// systems/ 와 params/ 안에서 Math.random / Date 를 쓰면 lint(=build)가 실패한다.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/systems/**', 'src/params/**'],
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
        { name: 'Date', message: 'Date도 결정성을 깬다. dateKey를 인자로 받아라.' },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
);
