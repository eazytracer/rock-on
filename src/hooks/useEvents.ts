import { useCallback, useEffect, useState } from 'react'
import { EventService } from '../services/EventService'
import { useAuth } from '../contexts/AuthContext'
import type {
  EventSummary,
  LineupItem,
  LineupRequest,
  EventParticipant,
} from '../models/Event'

/** The event's participants — the pool the host casts from. */
export function useEventParticipants(eventId: string | undefined) {
  const [participants, setParticipants] = useState<EventParticipant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!eventId) {
      setParticipants([])
      setLoading(false)
      return
    }
    setLoading(true)
    EventService.getParticipants(eventId).then(p => {
      if (!cancelled) {
        setParticipants(p)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [eventId])

  return { participants, loading }
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

/** A single event with its lineup + pending requests and host actions. */
export function useEventDetail(eventId: string | undefined) {
  const { user } = useAuth()
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

  const isManager = !!(event && user && event.hostUserId === user.id)

  const addRequest = useCallback(
    async (title: string, artist: string) => {
      if (!eventId) return { ok: false, error: 'No event' }
      const res = await EventService.addRequest(eventId, title, artist)
      if (res.ok) await refetch()
      return res
    },
    [eventId, refetch]
  )
  const approve = useCallback(
    async (id: string) => {
      await EventService.approveRequest(id)
      await refetch()
    },
    [refetch]
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
    approve,
    reject,
  }
}
