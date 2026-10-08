import { defineConfig } from 'eslint/config';
import typescriptEslint from 'typescript-eslint';

const styleRules = {
  curly: 'error',
  eqeqeq: 'error',
  'no-throw-literal': 'error',
  semi: ['error', 'always'],
};

export default defineConfig(
  { ignores: ['node_modules/**', 'dist/**', 'out/**', '.vscode-test/**', '.npm/**'] },
  {
    files: ['**/*.ts', '**/*.mts'],
    extends: [typescriptEslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.webview.json', './tsconfig.tooling.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: styleRules,
  },
  { files: ['**/*.js', '**/*.mjs'], rules: styleRules },
);
