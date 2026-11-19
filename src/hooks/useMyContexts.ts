import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { listMyContexts } from '../services/api/contexts'
import { queryKeys } from '../services/queryClient'
import type { BandMark } from '../services/api/bands'

/** The user's bands for the context switcher (name, role, members, unread dot). */
export function useMyContexts() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  return useQuery({
    queryKey: queryKeys.contexts.mine(userId),
    queryFn: listMyContexts,
    enabled: !!userId,
    staleTime: 60_000,
  })
}

/** Look up a band's mark from the contexts list (null until it loads). */
export function useBandMarkOf() {
  const { data } = useMyContexts()
  return (bandId: string | null | undefined) =>
    (data?.find(c => c.band_id === bandId)?.mark ?? null) as BandMark | null
}
