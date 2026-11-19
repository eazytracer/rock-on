import { useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FriendService } from '../services/FriendService'
import { EMPTY_ARRAY } from '../services/queryClient'
import { useAuth } from '../contexts/AuthContext'
import type { FriendRequestPolicy, MyFriendProfile } from '../models/Friend'

/** Per signed-in user, so a sign-out / sign-in in one tab never shows stale lists. */
const friendKeys = {
  all: (userId: string) => ['friends', userId] as const,
  list: (userId: string) => ['friends', userId, 'list'] as const,
  requests: (userId: string) => ['friends', userId, 'requests'] as const,
  profile: (userId: string) => ['friends', userId, 'profile'] as const,
}

function useRequestsQuery() {
  const userId = useAuth().user?.id ?? ''
  return useQuery({
    queryKey: friendKeys.requests(userId),
    queryFn: () => FriendService.getRequests(),
    enabled: !!userId,
  })
}

/**
 * Count of incoming (pending) friend requests, for nav badges. Shares the
 * Friends page's requests query; refreshes on route change.
 */
export function useIncomingRequestCount(): number {
  const { data, refetch } = useRequestsQuery()
  const { pathname } = useLocation()
  useEffect(() => {
    void refetch()
  }, [pathname, refetch])
  return data?.incoming.length ?? 0
}

export function useFriends() {
  const userId = useAuth().user?.id ?? ''
  const qc = useQueryClient()

  const friendsQ = useQuery({
    queryKey: friendKeys.list(userId),
    queryFn: () => FriendService.getFriends(),
    enabled: !!userId,
  })
  const requestsQ = useRequestsQuery()
  const profileQ = useQuery({
    queryKey: friendKeys.profile(userId),
    queryFn: () => FriendService.getMyProfile(),
    enabled: !!userId,
  })

  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: friendKeys.all(userId) }),
    [qc, userId]
  )

  /** Run a write, then refetch the lists. Throws on failure. */
  const write = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn()
      } finally {
        await refresh()
      }
    },
    [refresh]
  )

  const accept = useCallback(
    (id: string) => write(() => FriendService.acceptRequest(id)),
    [write]
  )
  const decline = useCallback(
    (id: string) => write(() => FriendService.declineRequest(id)),
    [write]
  )
  const cancel = useCallback(
    (id: string) => write(() => FriendService.cancelRequest(id)),
    [write]
  )
  const unfriend = useCallback(
    (friendshipId: string) => write(() => FriendService.unfriend(friendshipId)),
    [write]
  )
  const send = useCallback(
    async (target: { userId?: string; code?: string }) => {
      const res = await FriendService.sendRequest(target)
      if (res.ok) await refresh()
      return res
    },
    [refresh]
  )
  const searchByName = useCallback(
    (query: string) => FriendService.searchByName(query),
    []
  )

  /** Optimistic; rolls back and rethrows on failure. */
  const savePrivacy = useCallback(
    async (changes: {
      discoverable?: boolean
      policy?: FriendRequestPolicy
    }) => {
      const key = friendKeys.profile(userId)
      const before = qc.getQueryData<MyFriendProfile | null>(key)
      if (before) qc.setQueryData(key, { ...before, ...changes })
      try {
        await FriendService.savePrivacy(changes)
      } catch (err) {
        qc.setQueryData(key, before)
        throw err
      }
    },
    [qc, userId]
  )

  const requests = requestsQ.data
  return {
    friends: friendsQ.data ?? EMPTY_ARRAY,
    incoming: requests?.incoming ?? EMPTY_ARRAY,
    outgoing: requests?.outgoing ?? EMPTY_ARRAY,
    profile: profileQ.data ?? null,
    loading: friendsQ.isPending,
    friendsError: friendsQ.isError,
    requestsLoading: requestsQ.isPending,
    requestsError: requestsQ.isError,
    profileLoading: profileQ.isPending,
    profileError: profileQ.isError,
    refetchFriends: friendsQ.refetch,
    refetchRequests: requestsQ.refetch,
    refetchProfile: profileQ.refetch,
    accept,
    decline,
    cancel,
    unfriend,
    send,
    searchByName,
    savePrivacy,
  }
}
