import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { listMyContexts } from '../services/api/contexts'
import { queryKeys } from '../services/queryClient'

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
