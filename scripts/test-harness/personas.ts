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
 * `resetPersona` cleans up app-side rows first (in dependency order),
 * then deletes the auth user. There is **no FK from `auth.users` to
 * `public.users`** in this schema — they share the same UUID by
 * convention, but `auth.admin.deleteUser()` does *not* cascade. Several
 * `public.users` FKs from other tables are also `ON DELETE NO ACTION`
 * (RESTRICT), so the cleanup explicitly:
 *
 *   1. NULLs out `last_modified_by` on rows the user merely touched
 *      (preserves the row for other users / the band).
 *   2. Deletes rows the user owns where the FK is RESTRICT
 *      (songs.created_by, setlists.created_by, etc.).
 *   3. Deletes the `public.users` row (CASCADE handles
 *      user_profiles, band_memberships, jam_sessions/participants/matches,
 *      song_assignments.member_id, member_capabilities, song_personal_notes,
 *      song_note_entries — see baseline schema).
 *   4. Deletes the auth user.
 *
 * If you add a new RESTRICT FK to `public.users` in the schema, add a
 * corresponding cleanup step in `cascadeDeletePublicUserRows` below.
 */

import { SupabaseClient } from '@supabase/supabase-js'

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
    // Before creating a fresh auth user, sweep up any orphaned `public.users`
    // rows that share this email. The handle_new_user trigger will INSERT
    // INTO public.users on createUser, and that will fail on the email
    // UNIQUE constraint if an orphan exists from a previous half-finished
    // reset (e.g. an aborted run, or `auth.users` deleted out-of-band).
    // The error surfaces as the opaque "Database error creating new user"
    // from the Auth API, which is exactly what the original `--fresh` bug
    // produced — there's no FK from auth.users → public.users to keep
    // them in sync.
    const orphanIds = await findPublicUserIdsByEmail(admin, persona.email)
    for (const uid of orphanIds) {
      await cascadeDeletePublicUserRows(admin, uid)
    }

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

  // Even when the auth user is missing we may have orphaned `public.users`
  // rows from a previous half-finished reset (e.g. an aborted `--fresh`).
  // Look those up by email and clean them too — otherwise the next
  // `ensurePersona` will hit the email UNIQUE constraint when the auth
  // trigger tries to insert a fresh public.users row.
  const orphanIds = await findPublicUserIdsByEmail(admin, persona.email)
  if (existing && !orphanIds.includes(existing.id)) {
    orphanIds.push(existing.id)
  }

  if (orphanIds.length === 0 && !existing) return false

  for (const uid of orphanIds) {
    await cascadeDeletePublicUserRows(admin, uid)
  }

  if (existing) {
    const { error } = await admin.auth.admin.deleteUser(existing.id)
    if (error) throw error
  }

  return true
}

/**
 * Look up app-side user rows by email — used during reset to catch
 * orphans where `public.users` outlived its `auth.users` row.
 */
async function findPublicUserIdsByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string[]> {
  const { data, error } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
  if (error) throw error
  return ((data as Array<{ id: string }>) ?? []).map(r => r.id)
}

/**
 * Hand-rolled cascade for a single `public.users` id. See file-level
 * docstring for why this exists. Each step is idempotent (delete-by-eq).
 *
 * Ordering rules:
 *  - NULL out `last_modified_by` first so we don't try to delete a row
 *    that something else still references through that column.
 *  - Delete leaf rows (audit_log, assignments) before their parents
 *    (songs/setlists/shows) when both have RESTRICT FKs to users.
 *  - Delete the `public.users` row last; its CASCADE FKs handle the rest
 *    (user_profiles, band_memberships, jam_sessions/participants/matches,
 *    member_capabilities, song_personal_notes, song_note_entries,
 *    song_assignments.member_id).
 */
async function cascadeDeletePublicUserRows(
  admin: SupabaseClient,
  uid: string
): Promise<void> {
  // Step 1: clear RESTRICT-FK references where the user merely touched
  // a row owned by another principal (band, other user). The row stays.
  await admin
    .from('songs')
    .update({ last_modified_by: null })
    .eq('last_modified_by', uid)
  await admin
    .from('setlists')
    .update({ last_modified_by: null })
    .eq('last_modified_by', uid)
  await admin
    .from('shows')
    .update({ last_modified_by: null })
    .eq('last_modified_by', uid)
  await admin
    .from('practice_sessions')
    .update({ last_modified_by: null })
    .eq('last_modified_by', uid)
  await admin
    .from('jam_sessions')
    .update({ last_modified_by: null })
    .eq('last_modified_by', uid)

  // Step 2: delete leaf rows that hold RESTRICT FKs to users (and to
  // their parent rows, which we're about to delete next).
  await admin.from('audit_log').delete().eq('user_id', uid)
  await admin.from('song_assignments').delete().eq('added_by', uid)
  await admin.from('casting_templates').delete().eq('created_by', uid)
  await admin.from('song_castings').delete().eq('created_by', uid)
  await admin.from('song_group_memberships').delete().eq('added_by', uid)
  await admin.from('song_groups').delete().eq('created_by', uid)
  await admin.from('invite_codes').delete().eq('created_by', uid)

  // Step 3: rows the user owns directly via RESTRICT FK. For test
  // personas we drop them outright — orphaning band records would
  // confuse subsequent harness runs. (`bands.created_by` is SET NULL,
  // so any band the persona created is left in place with a null
  // creator, which is the right call: bands often have other members.)
  await admin.from('shows').delete().eq('created_by', uid)
  await admin.from('setlists').delete().eq('created_by', uid)
  await admin.from('songs').delete().eq('created_by', uid)
  // Personal songs/setlists may have been authored by a different user
  // and shared via context_id. Those use TEXT context_id = userId — wipe
  // them too so the harness can re-seed cleanly.
  await admin.from('songs').delete().eq('context_id', uid)
  await admin.from('setlists').delete().eq('context_id', uid)

  // Step 4: the public.users row itself — CASCADE FKs do the rest.
  await admin.from('users').delete().eq('id', uid)
}
