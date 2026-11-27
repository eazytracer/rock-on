/**
 * Your account and profile (docs/redesign/13 · 6e, 6f): profile (name,
 * ordered instruments, personal colour), sign-in methods, change password and
 * delete account. Errors arrive as ApiError keys: `wrong_password`,
 * `weak_password`, `owns_band` (HINT names the bands), `unknown`.
 */
import { FunctionsHttpError } from '@supabase/supabase-js'
import { api } from './client'
import { ApiError, toApiError } from './errors'

export const PASSWORD_MIN = 8

export interface MyProfile {
  name: string
  /** In the user's order; the first shows first where space is short. */
  instruments: string[]
  /** Hex, or null for the colour derived from the name. */
  personalColor: string | null
}

export async function getMyProfile(userId: string): Promise<MyProfile> {
  const [user, profile] = await Promise.all([
    api().from('users').select('name').eq('id', userId).maybeSingle(),
    api()
      .from('user_profiles')
      .select('display_name, instruments, personal_color')
      .eq('user_id', userId)
      .maybeSingle(),
  ])
  if (user.error) throw toApiError(user.error)
  if (profile.error) throw toApiError(profile.error)
  return {
    name: profile.data?.display_name?.trim() || user.data?.name || '',
    instruments: profile.data?.instruments ?? [],
    personalColor: profile.data?.personal_color ?? null,
  }
}

/**
 * Saves the given fields. The name goes to the auth metadata (sign-in copies
 * it into `users.name`), `users.name` and `user_profiles.display_name`, so
 * every place that shows a name agrees.
 */
export async function saveMyProfile(
  userId: string,
  changes: Partial<MyProfile>
): Promise<void> {
  const { error: ensureError } = await api().rpc('ensure_my_profile')
  if (ensureError) throw toApiError(ensureError)

  const row: {
    display_name?: string
    instruments?: string[]
    personal_color?: string | null
    updated_date: string
  } = { updated_date: new Date().toISOString() }
  if (changes.instruments !== undefined) row.instruments = changes.instruments
  if (changes.personalColor !== undefined)
    row.personal_color = changes.personalColor

  if (changes.name !== undefined) {
    const name = changes.name.trim()
    row.display_name = name
    const { error: authError } = await api().auth.updateUser({
      data: { name },
    })
    if (authError) throw new ApiError('unknown', authError.message)
    const { error: userError } = await api()
      .from('users')
      .update({ name })
      .eq('id', userId)
    if (userError) throw toApiError(userError)
  }

  const { error } = await api()
    .from('user_profiles')
    .update(row)
    .eq('user_id', userId)
  if (error) throw toApiError(error)
}

/** Providers on the signed-in account, from the session's identities. */
export async function getSignInMethods(): Promise<string[]> {
  const { data, error } = await api().auth.getUser()
  if (error) throw new ApiError('unknown', error.message)
  const providers = (data.user?.identities ?? []).map(i => i.provider)
  return [...new Set(providers)]
}

/** Asks for the current password first (a fresh sign-in), then sets the new one. */
export async function changePassword(
  email: string,
  current: string,
  next: string
): Promise<void> {
  if (next.length < PASSWORD_MIN)
    throw new ApiError(
      'weak_password',
      `Use at least ${PASSWORD_MIN} characters.`
    )
  const { error: signInError } = await api().auth.signInWithPassword({
    email,
    password: current,
  })
  if (signInError)
    throw new ApiError(
      'wrong_password',
      "That isn't your current password. Check for typos."
    )
  const { error } = await api().auth.updateUser({ password: next })
  if (error) throw new ApiError('unknown', error.message)
}

/**
 * The `delete-account` edge function: deletes everything personal, then the
 * sign-in itself. Throws `owns_band` (with the server's copy) while you own a
 * band. The caller signs out afterwards.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await api().functions.invoke('delete-account', {
    method: 'POST',
  })
  if (!error) return
  if (error instanceof FunctionsHttpError) {
    const body = (await (error.context as Response)
      .json()
      .catch(() => null)) as { key?: string; message?: string } | null
    if (body?.key) throw new ApiError(body.key, body.message ?? body.key)
  }
  throw new ApiError('unknown', "That didn't work. Try again.")
}
