import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FriendService } from '../services/FriendService'
import type {
  FriendSummary,
  FriendRequestSummary,
  MyFriendProfile,
  FriendRequestPolicy,
} from '../models/Friend'

/**
 * Lightweight count of incoming (pending) friend requests, for nav badges.
 * Mirrors `useUnreadCount` — refetches on route change, no heavy state.
 */
export function useIncomingRequestCount(): number {
  const [count, setCount] = useState(0)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    FriendService.getRequests().then(r => {
      if (!cancelled) setCount(r.incoming.length)
    })
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  return count
}

export function useFriends() {
  const [friends, setFriends] = useState<FriendSummary[]>([])
  const [incoming, setIncoming] = useState<FriendRequestSummary[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequestSummary[]>([])
  const [profile, setProfile] = useState<MyFriendProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const [f, r, p] = await Promise.all([
      FriendService.getFriends(),
      FriendService.getRequests(),
      FriendService.getMyProfile(),
    ])
    setFriends(f)
    setIncoming(r.incoming)
    setOutgoing(r.outgoing)
    setProfile(p)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const accept = useCallback(
    async (id: string) => {
      await FriendService.acceptRequest(id)
      await refetch()
    },
    [refetch]
  )
  const decline = useCallback(
    async (id: string) => {
      await FriendService.declineRequest(id)
      await refetch()
    },
    [refetch]
  )
  const unfriend = useCallback(
    async (friendshipId: string) => {
      await FriendService.unfriend(friendshipId)
      await refetch()
    },
    [refetch]
  )
  const sendToCode = useCallback(
    async (code: string) => {
      const res = await FriendService.sendRequestToCode(code)
      if (res.ok) await refetch()
      return res
    },
    [refetch]
  )
  const setDiscoverable = useCallback(async (v: boolean) => {
    setProfile(p => (p ? { ...p, discoverable: v } : p))
    await FriendService.setDiscoverable(v)
  }, [])
  const setPolicy = useCallback(async (v: FriendRequestPolicy) => {
    setProfile(p => (p ? { ...p, policy: v } : p))
    await FriendService.setPolicy(v)
  }, [])

  return {
    friends,
    incoming,
    outgoing,
    profile,
    loading,
    refetch,
    accept,
    decline,
    unfriend,
    sendToCode,
    setDiscoverable,
    setPolicy,
  }
}
