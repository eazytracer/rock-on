import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useUpcomingShows } from '../../../src/hooks/useShows'
import { useUpcomingPractices } from '../../../src/hooks/usePractices'
import { ShowService } from '../../../src/services/ShowService'
import { PracticeSessionService } from '../../../src/services/PracticeSessionService'
import { createQueryWrapper } from '../helpers/queryWrapper'

vi.mock('../../../src/services/ShowService')
vi.mock('../../../src/services/PracticeSessionService')
vi.mock('../../../src/hooks/useRealtimeInvalidate', () => ({
  useRealtimeInvalidate: vi.fn(),
}))

// ShowsPage (and the calendar) key effects that fetch + setState on these
// derived arrays; a fresh array per render made those effects refetch forever.
describe('upcoming/past split hooks keep stable references across renders', () => {
  it('useUpcomingShows', async () => {
    vi.mocked(ShowService.getShows).mockResolvedValue({
      shows: [
        {
          id: 's1',
          scheduledDate: new Date(Date.now() + 86_400_000),
          status: 'scheduled',
        },
        {
          id: 's2',
          scheduledDate: new Date(Date.now() - 86_400_000),
          status: 'completed',
        },
      ],
    } as never)

    const { result, rerender } = renderHook(() => useUpcomingShows('band-1'), {
      wrapper: createQueryWrapper().wrapper,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const { upcomingShows, pastShows } = result.current
    expect(upcomingShows).toHaveLength(1)
    expect(pastShows).toHaveLength(1)
    rerender()
    expect(result.current.upcomingShows).toBe(upcomingShows)
    expect(result.current.pastShows).toBe(pastShows)
  })

  it('useUpcomingPractices', async () => {
    vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
      sessions: [
        {
          id: 'p1',
          type: 'rehearsal',
          scheduledDate: new Date(Date.now() + 86_400_000),
          duration: 120,
        },
        {
          id: 'p2',
          type: 'rehearsal',
          scheduledDate: new Date(Date.now() - 86_400_000),
          duration: 120,
        },
      ],
    } as never)

    const { result, rerender } = renderHook(
      () => useUpcomingPractices('band-1'),
      { wrapper: createQueryWrapper().wrapper }
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    const { upcomingPractices, pastPractices } = result.current
    expect(upcomingPractices).toHaveLength(1)
    expect(pastPractices).toHaveLength(1)
    rerender()
    expect(result.current.upcomingPractices).toBe(upcomingPractices)
    expect(result.current.pastPractices).toBe(pastPractices)
  })
})
