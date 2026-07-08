import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared chainable + thenable Supabase builder mock (hoisted so vi.mock can use it).
const h = vi.hoisted(() => {
  const state: { result: { data: unknown; error: unknown } } = {
    result: { data: null, error: null },
  }
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'insert', 'update', 'delete']) {
    builder[m] = vi.fn(() => builder)
  }
  // Terminal for .single(); and make the builder itself awaitable (delete/order paths).
  builder.single = vi.fn(() => Promise.resolve(state.result))
  builder.then = (resolve: (v: unknown) => void) => resolve(state.result)
  const from = vi.fn(() => builder)
  return { state, builder, from }
})

vi.mock('../../../src/services/supabase/client', () => ({
  getSupabaseClient: () => ({ from: h.from }),
}))

import { TuningService } from '../../../src/services/TuningService'

const b = h.builder as Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  h.state.result = { data: null, error: null }
  vi.clearAllMocks()
})

describe('TuningService.getCustomTunings', () => {
  it('selects non-builtins (RLS-scoped) and maps snake_case → camelCase', async () => {
    h.state.result = {
      data: [
        {
          id: 't1',
          instrument: 'guitar',
          string_count: 6,
          pitches: [40, 45, 50, 55, 59, 64],
          name: 'My Tuning',
          slug: null,
          is_builtin: false,
          color: '#123456',
          context_type: 'personal',
          context_id: 'user-1',
          created_by: 'user-1',
        },
      ],
      error: null,
    }
    const out = await TuningService.getCustomTunings()

    expect(h.from).toHaveBeenCalledWith('tunings')
    expect(b.select).toHaveBeenCalledWith('*')
    expect(b.eq).toHaveBeenCalledWith('is_builtin', false)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      id: 't1',
      stringCount: 6,
      isBuiltin: false,
      contextType: 'personal',
      contextId: 'user-1',
      createdBy: 'user-1',
    })
  })

  it('throws a clear message on error', async () => {
    h.state.result = { data: null, error: { message: 'boom' } }
    await expect(TuningService.getCustomTunings()).rejects.toThrow(/boom/)
  })
})

describe('TuningService.getAllTunings', () => {
  it('selects all visible tunings (no is_builtin filter — RLS scopes it)', async () => {
    h.state.result = {
      data: [
        {
          id: 'b1',
          is_builtin: true,
          instrument: 'guitar',
          string_count: 6,
          pitches: [],
          name: 'Standard',
        },
        {
          id: 'c1',
          is_builtin: false,
          instrument: 'guitar',
          string_count: 6,
          pitches: [],
          name: 'Mine',
        },
      ],
      error: null,
    }
    const out = await TuningService.getAllTunings()
    expect(h.from).toHaveBeenCalledWith('tunings')
    // No .eq('is_builtin', …) filter — the whole visible set comes back via RLS.
    expect(b.eq).not.toHaveBeenCalled()
    expect(out.map(t => t.id)).toEqual(['b1', 'c1'])
    expect(out[0].isBuiltin).toBe(true)
    expect(out[1].isBuiltin).toBe(false)
  })
})

describe('TuningService.createCustomTuning', () => {
  const ctx = {
    contextType: 'personal' as const,
    contextId: 'user-1',
    createdBy: 'user-1',
  }
  const newTuning = {
    instrument: 'guitar' as const,
    stringCount: 6,
    pitches: [40, 45, 50, 55, 59, 64],
    name: 'Fresh',
  }

  it('inserts a non-builtin owned by the caller (created_by + context)', async () => {
    h.state.result = {
      data: { id: 'new', is_builtin: false, name: 'Fresh', string_count: 6 },
      error: null,
    }
    await TuningService.createCustomTuning(newTuning, ctx)

    const payload = b.insert.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toMatchObject({
      is_builtin: false,
      string_count: 6,
      name: 'Fresh',
      context_type: 'personal',
      context_id: 'user-1',
      created_by: 'user-1',
    })
  })

  it('throws on RLS/insert error', async () => {
    h.state.result = { data: null, error: { message: 'denied' } }
    await expect(
      TuningService.createCustomTuning(newTuning, ctx)
    ).rejects.toThrow(/denied/)
  })
})

describe('TuningService.updateCustomTuning', () => {
  it('sends only the provided fields (snake_case) and filters by id', async () => {
    h.state.result = { data: { id: 't1', name: 'Renamed' }, error: null }
    await TuningService.updateCustomTuning('t1', { name: 'Renamed' })

    const payload = b.update.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toEqual({ name: 'Renamed' })
    expect(payload).not.toHaveProperty('created_by') // ownership never sent
    expect(b.eq).toHaveBeenCalledWith('id', 't1')
  })

  it('maps stringCount → string_count', async () => {
    h.state.result = { data: { id: 't1' }, error: null }
    await TuningService.updateCustomTuning('t1', { stringCount: 7 })
    expect(b.update.mock.calls[0][0]).toEqual({ string_count: 7 })
  })
})

describe('TuningService.deleteCustomTuning', () => {
  it('deletes by id and resolves on 0-row (RLS-blocked) success', async () => {
    h.state.result = { data: null, error: null }
    await expect(
      TuningService.deleteCustomTuning('t1')
    ).resolves.toBeUndefined()
    expect(b.delete).toHaveBeenCalled()
    expect(b.eq).toHaveBeenCalledWith('id', 't1')
  })

  it('throws on a real delete error', async () => {
    h.state.result = { data: null, error: { message: 'nope' } }
    await expect(TuningService.deleteCustomTuning('t1')).rejects.toThrow(/nope/)
  })
})
