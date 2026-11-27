/**
 * Guest / TV / kiosk specs: the live specs' fresh jam, plus anon RPC calls
 * (what a phone without an account sends) and a tidy that removes the jam.
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import type { LiveJam } from './liveSetup'
import { getSupabaseAdmin } from '../../fixtures/supabase'

function env(name: string): string {
  if (process.env[name]) return process.env[name]!
  const line = readFileSync('.env.development', 'utf8')
    .split('\n')
    .find(l => l.startsWith(`${name}=`))
  if (!line) throw new Error(`${name} missing from .env.development`)
  return line
    .slice(name.length + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
}

export const anon = () =>
  createClient(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

/** Ends a live jam, deletes a planned one. */
export async function tidy(jam: LiveJam | undefined) {
  if (!jam) return
  await jam.eric.rpc('end_jam', { p_event: jam.id })
  await jam.eric.rpc('delete_jam', { p_event: jam.id })
}

export const PHONE = { width: 390, height: 844 }
export const IPAD = { width: 1024, height: 768 }
export const TV = { width: 1920, height: 1080 }

/**
 * Locally every call comes from one IP (the Docker gateway), so the per-IP
 * jam limits (codes, joins, pairing) trip across specs. Start each test clean.
 */
export async function resetRateLimits() {
  const admin = await getSupabaseAdmin()
  await admin.from('jam_rate_limits').delete().neq('bucket', '')
}
