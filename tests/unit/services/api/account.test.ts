import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
}))
const invoke = vi.hoisted(() => vi.fn())

vi.mock('../../../../src/services/api/client', () => ({
  api: () => ({ auth, functions: { invoke } }),
}))

import {
  changePassword,
  deleteAccount,
  getSignInMethods,
} from '../../../../src/services/api/account'

beforeEach(() => vi.clearAllMocks())

describe('changePassword', () => {
  it('refuses a new password under 8 characters without calling auth', async () => {
    await expect(changePassword('a@b.c', 'old', 'short')).rejects.toMatchObject(
      { key: 'weak_password' }
    )
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('checks the current password first and stops when it is wrong', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'bad' } })
    await expect(
      changePassword('a@b.c', 'wrong', 'longenough')
    ).rejects.toMatchObject({ key: 'wrong_password' })
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('re-authenticates, then sets the new password', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null })
    auth.updateUser.mockResolvedValue({ error: null })
    await changePassword('a@b.c', 'old-pass', 'new-password')
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.c',
      password: 'old-pass',
    })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' })
  })
})

describe('getSignInMethods', () => {
  it('lists each identity provider once', async () => {
    auth.getUser.mockResolvedValue({
      data: {
        user: {
          identities: [
            { provider: 'email' },
            { provider: 'google' },
            { provider: 'email' },
          ],
        },
      },
      error: null,
    })
    expect(await getSignInMethods()).toEqual(['email', 'google'])
  })
})

describe('deleteAccount', () => {
  it('resolves on success', async () => {
    invoke.mockResolvedValue({ data: null, error: null })
    await expect(deleteAccount()).resolves.toBeUndefined()
    expect(invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' })
  })

  it("passes the server's owns_band key and copy through", async () => {
    const res = new Response(
      JSON.stringify({
        key: 'owns_band',
        message: 'Transfer Demo Band first. You own it.',
      }),
      { status: 409 }
    )
    invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(res) })
    await expect(deleteAccount()).rejects.toMatchObject({
      key: 'owns_band',
      message: 'Transfer Demo Band first. You own it.',
    })
  })

  it('falls back to a retry line for other failures', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('network') })
    await expect(deleteAccount()).rejects.toMatchObject({ key: 'unknown' })
  })
})
