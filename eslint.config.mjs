import next from 'eslint-config-next';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  ...next,
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
