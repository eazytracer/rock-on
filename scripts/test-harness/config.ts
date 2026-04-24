/**
 * Test Harness — configuration, env loading, and persona registry.
 *
 * All persona definitions are static (stable across runs). Passwords
 * are harness-specific and only used against the local Supabase
 * instance; refusing to run against non-local URLs is enforced in
 * `clients.ts`.
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ----------------------------------------------------------------------
// Env loading — prefers .env.test, falls back to .env.local.
// ----------------------------------------------------------------------

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const ROOT = resolve(__dirname, '..', '..')
const envFromTest = loadEnvFile(resolve(ROOT, '.env.test'))
const envFromLocal = loadEnvFile(resolve(ROOT, '.env.local'))
const env = { ...envFromLocal, ...envFromTest, ...process.env }

function required(name: string): string {
  const v = env[name]
  if (!v) {
    throw new Error(
      `Missing required env var ${name}. Ensure .env.test exists (run npm run setup:local).`
    )
  }
  return v
}

/**
 * Resolve Supabase keys, preferring JWT format.
 *
 * `.env.test` may contain the newer `sb_publishable_` / `sb_secret_`
 * key format (written by `scripts/setup-local-env.sh`). supabase-js
 * 2.x admin APIs (auth.admin.*) only accept the legacy JWT
 * `service_role` key, so when we detect the new format we fall back
 * to `supabase status -o json` which exposes both.
 */
function resolveLocalKeys(url: string): {
  anonKey: string
  serviceRoleKey: string
} {
  const rawAnon = env['VITE_SUPABASE_ANON_KEY'] ?? ''
  const rawService = env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
  const anonLooksJwt = rawAnon.startsWith('eyJ')
  const serviceLooksJwt = rawService.startsWith('eyJ')
  if (anonLooksJwt && serviceLooksJwt) {
    return { anonKey: rawAnon, serviceRoleKey: rawService }
  }

  // Only attempt fallback for local URLs. (Non-local URLs are rejected
  // downstream in clients.ts anyway, but we skip spawning the CLI.)
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error(
      'Keys in .env.test are not JWT format and URL is not local. ' +
        'Regenerate .env.test or set JWT keys explicitly.'
    )
  }
  try {
    const statusJson = execSync('supabase status -o json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const parsed = JSON.parse(statusJson) as Record<string, string>
    if (!parsed.ANON_KEY || !parsed.SERVICE_ROLE_KEY) {
      throw new Error(
        'ANON_KEY / SERVICE_ROLE_KEY not present in supabase status'
      )
    }
    return {
      anonKey: parsed.ANON_KEY,
      serviceRoleKey: parsed.SERVICE_ROLE_KEY,
    }
  } catch (err) {
    throw new Error(
      `Could not obtain JWT keys via "supabase status -o json": ` +
        `${err instanceof Error ? err.message : String(err)}`
    )
  }
}

const _url = required('VITE_SUPABASE_URL')
const _keys = resolveLocalKeys(_url)

export const CONFIG = {
  supabaseUrl: _url,
  anonKey: _keys.anonKey,
  serviceRoleKey: _keys.serviceRoleKey,
}

// ----------------------------------------------------------------------
// Personas — fixed registry. Add new ones here; `ensure` will provision
// them on next run. Passwords are public-by-design (local-only harness).
// ----------------------------------------------------------------------

export interface Persona {
  /** Short name used as CLI arg */
  name: string
  email: string
  password: string
  displayName: string
}

export const PERSONAS: readonly Persona[] = [
  {
    name: 'alice',
    email: 'alice@test.local',
    password: 'harness-alice-7k2p',
    displayName: 'Alice (Harness)',
  },
  {
    name: 'bob',
    email: 'bob@test.local',
    password: 'harness-bob-4m9x',
    displayName: 'Bob (Harness)',
  },
  {
    name: 'carol',
    email: 'carol@test.local',
    password: 'harness-carol-3q8z',
    displayName: 'Carol (Harness)',
  },
] as const

export function findPersona(name: string): Persona {
  const p = PERSONAS.find(p => p.name === name)
  if (!p) {
    throw new Error(
      `Unknown persona "${name}". Known: ${PERSONAS.map(p => p.name).join(', ')}`
    )
  }
  return p
}

// ----------------------------------------------------------------------
// Song fixtures — intentional overlap across personas so jam matching
// always finds at least 2 common songs between any pair.
// ----------------------------------------------------------------------

export interface SongFixture {
  title: string
  artist: string
  duration: number // seconds
  key: string
  tempo: number // bpm
  difficulty: number // 1..5
  guitarTuning: string
  notes?: string
}

const COMMON: SongFixture[] = [
  {
    title: 'All Star',
    artist: 'Smash Mouth',
    duration: 194,
    key: 'F#',
    tempo: 104,
    difficulty: 2,
    guitarTuning: 'Standard',
  },
  {
    title: 'Wonderwall',
    artist: 'Oasis',
    duration: 258,
    key: 'F#m',
    tempo: 87,
    difficulty: 2,
    guitarTuning: 'Standard',
  },
]

export const SONG_PRESETS: Record<string, Record<string, SongFixture[]>> = {
  default: {
    alice: [
      ...COMMON,
      {
        title: 'Creep',
        artist: 'Radiohead',
        duration: 239,
        key: 'G',
        tempo: 92,
        difficulty: 2,
        guitarTuning: 'Standard',
      },
    ],
    bob: [
      ...COMMON,
      {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        duration: 354,
        key: 'Bb',
        tempo: 72,
        difficulty: 4,
        guitarTuning: 'Standard',
      },
    ],
    carol: [
      COMMON[1], // Wonderwall only — minimal overlap
      {
        title: 'Stairway to Heaven',
        artist: 'Led Zeppelin',
        duration: 482,
        key: 'Am',
        tempo: 82,
        difficulty: 4,
        guitarTuning: 'Standard',
      },
    ],
  },
}
