import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      // UniPass keeps its own typecheck, static audit and tests (packages/unipass).
      'packages/unipass/**',
      // Git-ignored local output such as the UniPass export tree.
      '.artifacts/**',
      '**/dist/**',
      '**/.output/**',
      '**/.wxt/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/coverage/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // TypeScript and the existing strict compiler settings own type safety.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
)
