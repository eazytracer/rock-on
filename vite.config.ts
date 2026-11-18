import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Get git commit hash for cache busting
const getGitHash = () => {
  try {
    // Try Vercel environment variable first
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      return process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7)
    }
    // Fall back to git command
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'local'
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load test environment variables when running tests
  // This allows journey/contract/integration tests to access Supabase
  const testEnv = mode === 'test' ? loadEnv('test', process.cwd(), '') : {}

  // Local Supabase, for the same-origin proxy below (the container sets
  // VITE_SUPABASE_URL to host.docker.internal; the devcontainer reads .env).
  const supabaseTarget =
    process.env.VITE_SUPABASE_URL ||
    loadEnv(mode, process.cwd(), '').VITE_SUPABASE_URL ||
    'http://127.0.0.1:54321'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      // The https dev hostname (a reverse proxy on the home network → :5173),
      // so a phone gets a secure context and the tuner's mic works.
      allowedHosts: ['rockon.tnxhomelab.com'],
      // Over https the page can't call http://…:54321 (mixed content), so it
      // calls Supabase on its own origin and Vite forwards it (getSupabaseUrl).
      proxy: Object.fromEntries(
        [
          '/rest/v1',
          '/auth/v1',
          '/storage/v1',
          '/functions/v1',
          '/realtime/v1',
        ].map(p => [
          p,
          {
            target: supabaseTarget,
            changeOrigin: true,
            ws: p === '/realtime/v1',
          },
        ])
      ),
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/tests/e2e/**/*.spec.ts', // Exclude Playwright E2E tests
      ],
      css: true,
      env: testEnv, // Load .env.test for journey/contract/integration tests
    },
    build: {
      // Add git hash to output filenames for cache busting
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name]-${getGitHash()}-[hash].js`,
          chunkFileNames: `assets/[name]-${getGitHash()}-[hash].js`,
          assetFileNames: `assets/[name]-${getGitHash()}-[hash].[ext]`,
        },
      },
    },
  }
})
