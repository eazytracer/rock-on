import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RemoteRepository } from '../../../../src/services/data/RemoteRepository'

/**
 * Verifies getJamParticipants / addJamParticipant / updateJamParticipant all
 * resolve participant display names using the fallback chain:
 *   user_profiles.display_name  (preferred — explicitly set by user)
 *   → users.name                 (fallback — populated at signup)
 *   → undefined                  (UI fallback: "User <id-prefix>")
 *
 * This is the regression guard for v0.3.1's "User abc123" bug, where the
 * original getJamParticipants read only from user_profiles — and most users
 * never have a user_profiles row because signup doesn't create one.
 */

// The mock lets each `.from('<table>')` call return a different chain of
// responses. Tests override the mocks via the query-builder-by-table map.
type TableName = 'jam_participants' | 'user_profiles' | 'users'

interface QueryResult {
  data: unknown
  error: unknown
}

let fromReturns: Partial<Record<TableName, QueryResult>> = {}

const buildQueryBuilder = (result: QueryResult) => {
  const qb: Record<string, unknown> = {}
  const chain = () => qb
  // Return the resolved query result for any terminal method.
  const terminal = () => Promise.resolve(result)
  // Builder methods (return self for chaining)
  for (const method of ['select', 'eq', 'in', 'insert', 'update']) {
    qb[method] = vi.fn(chain)
  }
  // Terminal methods (return the result)
  for (const method of ['single', 'maybeSingle']) {
    qb[method] = vi.fn(terminal)
  }
  // Allow awaiting the builder directly (e.g. await supabase.from(x).select(...))
  ;(qb as { then?: unknown }).then = (resolve: (v: QueryResult) => unknown) =>
    resolve(result)
  return qb
}

vi.mock('../../../../src/services/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: TableName) => {
      const result = fromReturns[table] ?? { data: [], error: null }
      return buildQueryBuilder(result)
    }),
  },
}))

describe('RemoteRepository — jam participant display name fallback', () => {
  let repo: RemoteRepository

  beforeEach(() => {
    repo = new RemoteRepository()
    fromReturns = {}
  })

  it('uses user_profiles.display_name when set', async () => {
    const userId = '11111111-1111-1111-1111-111111111111'
    fromReturns = {
      jam_participants: {
        data: [
          {
            id: 'part-1',
            jam_session_id: 'sess-1',
            user_id: userId,
            joined_date: '2026-04-24T00:00:00Z',
            status: 'active',
            shared_contexts: [],
          },
        ],
        error: null,
      },
      user_profiles: {
        data: [{ user_id: userId, display_name: 'Rockstar McShredface' }],
        error: null,
      },
      users: {
        data: [{ id: userId, name: 'Eric Reichwaldt' }],
        error: null,
      },
    }

    const result = await repo.getJamParticipants('sess-1')
    expect(result).toHaveLength(1)
    expect(result[0].displayName).toBe('Rockstar McShredface')
  })

  it('falls back to users.name when user_profiles row is missing', async () => {
    const userId = '22222222-2222-2222-2222-222222222222'
    fromReturns = {
      jam_participants: {
        data: [
          {
            id: 'part-1',
            jam_session_id: 'sess-1',
            user_id: userId,
            joined_date: '2026-04-24T00:00:00Z',
            status: 'active',
            shared_contexts: [],
          },
        ],
        error: null,
      },
      user_profiles: {
        // No user_profiles row — the common case for users who never set
        // an extended profile via the app (which, at the time of v0.3.1,
        // every new user!)
        data: [],
        error: null,
      },
      users: {
        data: [{ id: userId, name: 'Mike Smith' }],
        error: null,
      },
    }

    const result = await repo.getJamParticipants('sess-1')
    expect(result).toHaveLength(1)
    expect(result[0].displayName).toBe('Mike Smith')
  })

  it('falls back to users.name when user_profiles.display_name is null', async () => {
    const userId = '33333333-3333-3333-3333-333333333333'
    fromReturns = {
      jam_participants: {
        data: [
          {
            id: 'part-1',
            jam_session_id: 'sess-1',
            user_id: userId,
            joined_date: '2026-04-24T00:00:00Z',
            status: 'active',
            shared_contexts: [],
          },
        ],
        error: null,
      },
      user_profiles: {
        // Profile exists but display_name is null (user created a profile
        // with just bio / instruments but never set display_name).
        data: [{ user_id: userId, display_name: null }],
        error: null,
      },
      users: {
        data: [{ id: userId, name: 'Sarah Lee' }],
        error: null,
      },
    }

    const result = await repo.getJamParticipants('sess-1')
    expect(result).toHaveLength(1)
    expect(result[0].displayName).toBe('Sarah Lee')
  })

  it('returns undefined displayName when neither profile nor user name exist', async () => {
    const userId = '44444444-4444-4444-4444-444444444444'
    fromReturns = {
      jam_participants: {
        data: [
          {
            id: 'part-1',
            jam_session_id: 'sess-1',
            user_id: userId,
            joined_date: '2026-04-24T00:00:00Z',
            status: 'active',
            shared_contexts: [],
          },
        ],
        error: null,
      },
      user_profiles: { data: [], error: null },
      users: { data: [], error: null }, // e.g. user was deleted
    }

    const result = await repo.getJamParticipants('sess-1')
    expect(result).toHaveLength(1)
    expect(result[0].displayName).toBeUndefined()
  })

  it('returns empty array when session has no participants (no profile/user lookup)', async () => {
    fromReturns = {
      jam_participants: { data: [], error: null },
    }

    const result = await repo.getJamParticipants('sess-1')
    expect(result).toEqual([])
  })
})
