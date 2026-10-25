module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-extra-semi': 'off', // Prettier handles semicolons
    // Use src/utils/logger (environment-aware) instead of console.*
    'no-console': 'error',
  },
  overrides: [
    {
      // The logger wraps console; test setup and edge functions (Deno, logs to
      // Supabase) write to the console directly by design.
      files: ['src/utils/logger.ts', 'src/test/**', 'supabase/functions/**'],
      rules: { 'no-console': 'off' },
    },
  ],
}
