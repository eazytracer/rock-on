import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Show } from '../../../src/models/Show'

// Mock the RepositoryFactory module BEFORE importing ShowService.
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  const mockGetShow = vi.fn()
  const mockAddShow = vi.fn()
  const mockUpdateShow = vi.fn()

  const mockRepository = {
    getShow: mockGetShow,
    addShow: mockAddShow,
    updateShow: mockUpdateShow,
  }

  return {
    repository: mockRepository,
    createRepository: () => mockRepository,
  }
})

// Mock SetlistService so the fork path doesn't touch a real setlist store.
vi.mock('../../../src/services/SetlistService', () => ({
  SetlistService: {
    forkSetlist: vi.fn(),
    updateSetlist: vi.fn(),
  },
}))

import { ShowService } from '../../../src/services/ShowService'
import { repository } from '../../../src/services/data/RepositoryFactory'
import { SetlistService } from '../../../src/services/SetlistService'

const mockGetShow = repository.getShow as ReturnType<typeof vi.fn>
const mockAddShow = repository.addShow as ReturnType<typeof vi.fn>
const mockUpdateShow = repository.updateShow as ReturnType<typeof vi.fn>
const mockForkSetlist = SetlistService.forkSetlist as ReturnType<typeof vi.fn>
const mockUpdateSetlist = SetlistService.updateSetlist as ReturnType<
  typeof vi.fn
>

const buildSource = (): Show => ({
  id: 'src-1',
  bandId: 'band-1',
  name: 'Summer Gig',
  scheduledDate: new Date('2026-08-01T23:00:00Z'),
  duration: 90,
  venue: 'The Yard',
  location: 'Austin, TX',
  loadInTime: '18:00',
  soundcheckTime: '19:00',
  payment: 500,
  contacts: [
    {
      id: 'c-1',
      name: 'Booker',
      role: 'Promoter',
      phone: '555-1000',
    },
  ],
  setlistId: 'setlist-src',
  status: 'completed',
  notes: 'Great crowd',
  createdDate: new Date('2026-07-01'),
  updatedDate: new Date('2026-08-02'),
  version: 4,
  lastModifiedBy: 'user-9',
})

describe('ShowService.duplicateShow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // addShow echoes back what it's given (with the service-set fields).
    mockAddShow.mockImplementation((s: Show) => Promise.resolve(s))
    mockUpdateShow.mockResolvedValue(undefined)
    mockUpdateSetlist.mockResolvedValue(undefined)
  })

  it('copies template fields, resets instance state, and hosts a fresh show', async () => {
    mockGetShow.mockResolvedValue(buildSource())

    const chosen = new Date('2026-10-15T23:00:00Z')
    await ShowService.duplicateShow('src-1', {
      name: 'Summer Gig (copy)',
      scheduledDate: chosen,
      duration: 90,
      venue: 'The Yard',
      location: 'Austin, TX',
      loadInTime: '18:00',
      soundcheckTime: '19:00',
      payment: 500,
      notes: 'Great crowd',
    })

    expect(mockAddShow).toHaveBeenCalledTimes(1)
    const created = mockAddShow.mock.calls[0][0] as Show

    // Template fields copied / overrides applied
    expect(created.name).toBe('Summer Gig (copy)')
    expect(created.venue).toBe('The Yard')
    expect(created.payment).toBe(500)
    expect(created.scheduledDate).toBe(chosen)

    // Instance state reset
    expect(created.id).not.toBe('src-1')
    expect(created.status).toBe('scheduled')
    expect(created.version).toBeUndefined()
    expect(created.lastModifiedBy).toBeUndefined()

    // Contacts copied with FRESH ids (belong to the new show)
    expect(created.contacts).toHaveLength(1)
    expect(created.contacts![0].name).toBe('Booker')
    expect(created.contacts![0].id).not.toBe('c-1')
  })

  it('forks the chosen setlist into the new show', async () => {
    // First getShow → source; subsequent getShow calls → the created show.
    const source = buildSource()
    mockGetShow.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'src-1'
          ? source
          : ({ ...source, id, name: 'Summer Gig (copy)' } as Show)
      )
    )
    mockForkSetlist.mockResolvedValue({ id: 'setlist-forked' })

    await ShowService.duplicateShow(
      'src-1',
      { name: 'Summer Gig (copy)', scheduledDate: new Date('2026-10-15') },
      { mode: 'fork', sourceSetlistId: 'setlist-src' }
    )

    // Forked the source's setlist and linked it bidirectionally.
    expect(mockForkSetlist).toHaveBeenCalledWith(
      'setlist-src',
      'Summer Gig (copy)'
    )
    expect(mockUpdateSetlist).toHaveBeenCalledWith('setlist-forked', {
      showId: expect.any(String),
    })
  })

  it('creates no setlist when mode is none', async () => {
    mockGetShow.mockResolvedValue(buildSource())

    await ShowService.duplicateShow(
      'src-1',
      { name: 'Summer Gig (copy)', scheduledDate: new Date('2026-10-15') },
      { mode: 'none' }
    )

    expect(mockForkSetlist).not.toHaveBeenCalled()
    const created = mockAddShow.mock.calls[0][0] as Show
    expect(created.setlistId).toBeUndefined()
  })

  it('throws when the source show does not exist', async () => {
    mockGetShow.mockResolvedValue(null)

    await expect(
      ShowService.duplicateShow('missing', {
        name: 'x',
        scheduledDate: new Date(),
      })
    ).rejects.toThrow('Show not found')
  })
})
