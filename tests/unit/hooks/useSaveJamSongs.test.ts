/**
 * Jam songs builder save: tag changes on My Songs, band picks copied to My
 * Songs and the copies tagged `jam`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSaveJamSongs } from '../../../src/hooks/useSongs'
import { repository } from '../../../src/services/data/RepositoryFactory'
import { copyBandSongsToPersonalIds } from '../../../src/services/api/songs'
import { createQueryWrapper } from '../helpers/queryWrapper'
import type { Song } from '../../../src/models/Song'

vi.mock('../../../src/services/data/RepositoryFactory', () => ({
  repository: { updateSong: vi.fn() },
}))
vi.mock('../../../src/services/api/songs', () => ({
  deleteSong: vi.fn(),
  copyBandSongsToPersonalIds: vi.fn(),
}))
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ realtimeManager: null })),
}))

const song = (id: string, tags: string[]): Song =>
  ({ id, title: id, tags, contextType: 'personal' }) as Song

describe('useSaveJamSongs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repository.updateSong).mockResolvedValue({} as Song)
  })

  it('applies tag changes and tags the band-song copies', async () => {
    vi.mocked(copyBandSongsToPersonalIds).mockResolvedValue(['copy-1'])
    const { result } = renderHook(() => useSaveJamSongs(), {
      wrapper: createQueryWrapper().wrapper,
    })
    const n = await result.current({
      mySongs: [song('a', ['jam']), song('b', [])],
      picked: new Set(['b', 'band-1']),
      bandIds: ['band-1'],
    })
    expect(n).toBe(3)
    expect(copyBandSongsToPersonalIds).toHaveBeenCalledWith(['band-1'])
    expect(repository.updateSong).toHaveBeenCalledWith('a', { tags: [] })
    expect(repository.updateSong).toHaveBeenCalledWith('b', { tags: ['jam'] })
    expect(repository.updateSong).toHaveBeenCalledWith('copy-1', {
      tags: ['jam'],
    })
  })

  it('copies nothing without band picks', async () => {
    const { result } = renderHook(() => useSaveJamSongs(), {
      wrapper: createQueryWrapper().wrapper,
    })
    expect(
      await result.current({
        mySongs: [song('a', ['jam'])],
        picked: new Set(['a']),
        bandIds: [],
      })
    ).toBe(0)
    expect(copyBandSongsToPersonalIds).not.toHaveBeenCalled()
    expect(repository.updateSong).not.toHaveBeenCalled()
  })
})
