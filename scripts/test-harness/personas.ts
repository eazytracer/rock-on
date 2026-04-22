/**
 * Persona provisioning — create/reset fixed test users.
 *
 * A provisioned persona owns three rows:
 *   - auth.users (Supabase-managed, created via Auth Admin API)
 *   - public.users (app-side record with email + display name)
 *   - public.user_profiles (display_name for cross-user reads)
 *
 * `ensurePersona` is idempotent: if the auth user already exists the
 * app-side rows are upserted; no error is raised.
 *
 * `resetPersona` deletes the auth user; public.users / user_profiles
 * and all FK-cascading rows (songs, setlists, jam_sessions, etc.) are
 * removed automatically via ON DELETE CASCADE.
 */

import { adminClient } from './clients'
import { Persona } from './config'

async function findAuthUserByEmail(
  email: string
): Promise<{ id: string } | null> {
  const admin = adminClient()
  // listUsers doesn't support filtering by email directly; we paginate.
  // In practice the local DB has <100 auth users, so one page suffices.
  let page = 1
  const perPage = 200
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const hit = data.users.find(u => u.email === email)
    if (hit) return { id: hit.id }
    if (data.users.length < perPage) return null
    page += 1
  }
}

export async function ensurePersona(
  persona: Persona
): Promise<{ userId: string; created: boolean }> {
  const admin = adminClient()

  // 1. Auth user — create if missing, otherwise reuse.
  const existing = await findAuthUserByEmail(persona.email)
  let userId: string
  let created = false
  if (existing) {
    userId = existing.id
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: persona.email,
      password: persona.password,
      email_confirm: true, // skip email verification
      user_metadata: { display_name: persona.displayName },
    })
    if (error) throw error
    if (!data.user) throw new Error('createUser returned no user')
    userId = data.user.id
    created = true
  }

  // 2. Upsert public.users (id matches auth.users.id; FK enforced).
  {
    const { error } = await admin.from('users').upsert(
      {
        id: userId,
        email: persona.email,
        name: persona.displayName,
        auth_provider: 'email',
        account_tier: 'free',
        created_date: new Date().toISOString(),
        last_login: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    if (error) {
      throw new Error(
        `Upserting public.users for ${persona.name} failed: ${error.message}`
      )
    }
  }

  // 3. Upsert public.user_profiles (display_name for jam UI).
  {
    const { error } = await admin.from('user_profiles').upsert(
      {
        user_id: userId,
        display_name: persona.displayName,
      },
      { onConflict: 'user_id' }
    )
    if (error) {
      throw new Error(
        `Upserting user_profiles for ${persona.name} failed: ${error.message}`
      )
    }
  }

  return { userId, created }
}

export async function resetPersona(persona: Persona): Promise<boolean> {
  const admin = adminClient()
  const existing = await findAuthUserByEmail(persona.email)
  if (!existing) return false

  // Delete auth user — FKs cascade to public.users and everything below.
  const { error } = await admin.auth.admin.deleteUser(existing.id)
  if (error) throw error
  return true
}
