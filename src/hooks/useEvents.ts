import { useCallback, useEffect, useState } from 'react'
import { EventService } from '../services/EventService'
import { EventHandsService } from '../services/EventHandsService'
import { useAuth } from '../contexts/AuthContext'
import { useRealtimeTable } from './useRealtimeTable'
import type {
  EventSummary,
  LineupItem,
  LineupRequest,
  EventParticipant,
  RaisedHand,
} from '../models/Event'

/** The event's participants — the pool the host casts from. */
export function useEventParticipants(eventId: string | undefined) {
  const [participants, setParticipants] = useState<EventParticipant[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!eventId) {
      setParticipants([])
      setLoading(false)
      return
    }
    setParticipants(await EventService.getParticipants(eventId))
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Live-update as people are invited / join / RSVP.
  useRealtimeTable('event_participants', 'event_id', eventId, refetch)

  const removeParticipant = useCallback(
    async (userId: string) => {
      if (!eventId) return { ok: false, error: 'No event' }
      const res = await EventService.removeParticipant(eventId, userId)
      if (res.ok) await refetch()
      return res
    },
    [eventId, refetch]
  )
  const leaveEvent = useCallback(async () => {
    if (!eventId) return { ok: false, error: 'No event' }
    return EventService.leaveEvent(eventId)
  }, [eventId])
  const setParticipantTier = useCallback(
    async (userId: string, tier: 'cohost' | 'guest') => {
      if (!eventId) return { ok: false, error: 'No event' }
      const res = await EventService.setParticipantTier(eventId, userId, tier)
      if (res.ok) await refetch()
      return res
    },
    [eventId, refetch]
  )

  return {
    participants,
    loading,
    refetch,
    removeParticipant,
    leaveEvent,
    setParticipantTier,
  }
}

/** List of events the current user hosts or participates in. */
export function useEvents() {
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setEvents(await EventService.getEvents())
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { events, loading, refetch }
}

/**
 * Raised hands for an event — the guest raise-a-hand pool the host resolves.
 * Actions map 1:1 to the RLS-gated EventHandsService; the "accept → cast"
 * orchestration lives in the consumer (which owns the casting service).
 */
export function useEventHands(eventId: string | undefined) {
  const [hands, setHands] = useState<RaisedHand[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!eventId) {
      setHands([])
      setLoading(false)
      return
    }
    setHands(await EventHandsService.getHands(eventId))
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Live-update so the host sees a new raised hand (and guests see resolutions)
  // without leaving and re-entering the event.
  useRealtimeTable('event_hands', 'event_id', eventId, refetch)

  const raiseHand = useCallback(
    async (input: {
      lineupItemId: string
      roleKey: string
      userName: string
    }) => {
      if (!eventId) return { ok: false, error: 'No event' }
      const res = await EventHandsService.raiseHand({ eventId, ...input })
      if (res.ok) await refetch()
      return res
    },
    [eventId, refetch]
  )
  const withdrawHand = useCallback(
    async (handId: string) => {
      await EventHandsService.withdrawHand(handId)
      await refetch()
    },
    [refetch]
  )
  const acceptHand = useCallback(
    async (handId: string) => {
      await EventHandsService.acceptHand(handId)
      await refetch()
    },
    [refetch]
  )
  const declineHand = useCallback(
    async (handId: string) => {
      await EventHandsService.declineHand(handId)
      await refetch()
    },
    [refetch]
  )

  return {
    hands,
    loading,
    refetch,
    raiseHand,
    withdrawHand,
    acceptHand,
    declineHand,
  }
}

/** A single event with its lineup + pending requests and host actions. */
export function useEventDetail(eventId: string | undefined) {
  const { user, currentBandId } = useAuth()
  const [event, setEvent] = useState<EventSummary | null>(null)
  const [lineup, setLineup] = useState<LineupItem[]>([])
  const [requests, setRequests] = useState<LineupRequest[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!eventId) return
    const [ev, items, reqs] = await Promise.all([
      EventService.getEvent(eventId),
      EventService.getLineup(eventId),
      EventService.getPendingRequests(eventId),
    ])
    setEvent(ev)
    setLineup(items)
    setRequests(reqs)
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Live-update the lineup + requests: hosts see new song requests as they come
  // in, and requesters see their song appear once it's approved — without
  // leaving and re-entering the event. refetch re-pulls event + lineup +
  // requests together, so a request change also refreshes the promoted lineup.
  useRealtimeTable('event_lineup_requests', 'event_id', eventId, refetch)
  useRealtimeTable('event_lineup_items', 'event_id', eventId, refetch)

  const isManager = !!(event && user && event.hostUserId === user.id)

  const addRequest = useCallback(
    async (title: string, artist: string, parts?: string[]) => {
      if (!eventId) return { ok: false, error: 'No event' }
      const res = await EventService.addRequest(eventId, title, artist, parts)
      if (res.ok) await refetch()
      return res
    },
    [eventId, refetch]
  )
  const addLineupItem = useCallback(
    async (input: {
      title: string
      artist: string
      source?: LineupItem['source']
      songId?: string
      tuning?: string
      key?: string
    }) => {
      if (!eventId) return { ok: false, error: 'No event' }
      const res = await EventService.addLineupItem(eventId, input)
      if (res.ok) await refetch()
      return res
    },
    [eventId, refetch]
  )
  const reorderLineup = useCallback(
    async (orderedItemIds: string[]) => {
      if (!eventId) return { ok: false, error: 'No event' }
      // Optimistic local reorder so the drag settles instantly; refetch
      // reconciles with the server order (and reverts on failure).
      setLineup(prev => {
        const byId = new Map(prev.map(i => [i.id, i]))
        const next = orderedItemIds
          .map((id, idx) => {
            const item = byId.get(id)
            return item ? { ...item, position: idx + 1 } : null
          })
          .filter((i): i is LineupItem => i !== null)
        return next.length === prev.length ? next : prev
      })
      const res = await EventService.reorderLineup(eventId, orderedItemIds)
      await refetch()
      return res
    },
    [eventId, refetch]
  )
  const updateLineupItem = useCallback(
    async (
      itemId: string,
      input: { title: string; artist: string; tuning?: string; key?: string }
    ) => {
      const res = await EventService.updateLineupItem(itemId, input)
      if (res.ok) await refetch()
      return res
    },
    [refetch]
  )
  const removeLineupItem = useCallback(
    async (itemId: string) => {
      const res = await EventService.removeLineupItem(itemId)
      if (res.ok) await refetch()
      return res
    },
    [refetch]
  )
  const updateEvent = useCallback(
    async (patch: Parameters<typeof EventService.updateEvent>[1]) => {
      if (!eventId) return { ok: false, error: 'No event' }
      const res = await EventService.updateEvent(eventId, patch)
      if (res.ok) await refetch()
      return res
    },
    [eventId, refetch]
  )
  const cancelEvent = useCallback(async () => {
    if (!eventId) return { ok: false, error: 'No event' }
    const res = await EventService.cancelEvent(eventId)
    if (res.ok) await refetch()
    return res
  }, [eventId, refetch])
  const approve = useCallback(
    async (id: string) => {
      // Pass the host's current band so a matching request links to that
      // catalog (→ "Band" pill) instead of staying "Not linked".
      await EventService.approveRequest(id, currentBandId)
      await refetch()
    },
    [refetch, currentBandId]
  )
  const reject = useCallback(
    async (id: string) => {
      await EventService.rejectRequest(id)
      await refetch()
    },
    [refetch]
  )

  return {
    event,
    lineup,
    requests,
    isManager,
    loading,
    refetch,
    addRequest,
    addLineupItem,
    reorderLineup,
    updateLineupItem,
    removeLineupItem,
    updateEvent,
    cancelEvent,
    approve,
    reject,
  }
}
