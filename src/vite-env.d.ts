/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_ENABLE_AUTH: string
  readonly VITE_MOCK_AUTH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}