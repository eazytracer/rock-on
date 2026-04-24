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

    // ── Repository layer guardrail ──────────────────────────────────────────
    // Direct writes to db.* (Dexie) bypass the SyncRepository sync queue.
    // The change will never reach Supabase (source of truth).
    //
    // Use repository.addSong(), repository.updateSetlist(), etc. instead.
    // See: src/services/data/IDataRepository.ts
    //      tests/unit/guardrails/db-direct-write.test.ts  (ratchet + known violations)
    'no-restricted-syntax': [
      'error',
      {
        selector: [
          'CallExpression',
          "[callee.type='MemberExpression']",
          '[callee.property.name=/^(add|put|update|delete|bulkAdd|bulkPut|bulkDelete)$/]',
          "[callee.object.type='MemberExpression']",
          "[callee.object.object.name='db']",
        ].join(''),
        message:
          'Direct IndexedDB write bypasses the sync queue — Supabase will never see this change. ' +
          'Use repository.addSong(), repository.updateSong(), etc. (see IDataRepository.ts). ' +
          'If this file is part of the storage layer itself, add it to the override list in .eslintrc.cjs.',
      },
    ],
  },

  overrides: [
    {
      // Files that ARE the storage layer — legitimate direct db writes.
      // This list must match ALWAYS_ALLOWED in tests/unit/guardrails/db-direct-write.test.ts
      files: [
        'src/services/data/LocalRepository.ts',
        'src/services/data/SyncEngine.ts',
        'src/services/data/RealtimeManager.ts',
        'src/database/seedData.ts',
        'src/database/seedMvpData.ts',
        'src/database/services.ts',
        'src/services/DatabaseService.ts',
        'src/services/database/index.ts',
      ],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
    {
      // Known violations — existing tech debt. ESLint is set to 'warn' (not
      // 'error') so these don't block builds but stay visible in the IDE.
      // Migrate each file to repository.* and remove it from this list.
      // This list must match KNOWN_VIOLATIONS in tests/unit/guardrails/db-direct-write.test.ts
      files: [
        'src/services/auth/MockAuthService.ts',
        'src/services/auth/SupabaseAuthService.ts',
        'src/services/setup/InitialSetupService.ts',
        'src/services/CastingService.ts',
        'src/services/MemberCapabilityService.ts',
        'src/services/BandService.ts',
        'src/services/SongLinkingService.ts',
        'src/hooks/useBands.ts',
        'src/hooks/useSongs.ts',
        'src/pages/AuthPages.tsx',
        'src/pages/BandMembersPage.tsx',
        'src/components/auth/BandCreationForm.tsx',
      ],
      rules: {
        // Warn instead of error so builds aren't blocked, but the IDE highlights it
        'no-restricted-syntax': 'warn',
      },
    },
  ],
}
