import { defineConfig } from 'vite'
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
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    css: true
  },
  build: {
    // Add git hash to output filenames for cache busting
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${getGitHash()}-[hash].js`,
        chunkFileNames: `assets/[name]-${getGitHash()}-[hash].js`,
        assetFileNames: `assets/[name]-${getGitHash()}-[hash].[ext]`
      }
    }
  }
})
