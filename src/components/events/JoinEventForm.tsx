import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ticket } from 'lucide-react'
import { EventService } from '../../services/EventService'
import { useToast } from '../../contexts/ToastContext'

/**
 * Join an event by its share code. The reciprocal of the Access-tab code/QR —
 * used on the Calendar's Events view and the Events page so a logged-in user
 * can join without making a new account. On success, navigates to the event.
 */
export function JoinEventForm({ onJoined }: { onJoined?: () => void }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed || joining) return
    setJoining(true)
    const res = await EventService.joinByCode(trimmed)
    setJoining(false)
    if (res.ok && res.eventId) {
      showToast(`Joined ${res.name ?? 'the event'}`, 'success')
      setCode('')
      onJoined?.()
      navigate(`/events/${res.eventId}`)
    } else {
      showToast(res.error ?? 'Could not join that event', 'error')
    }
  }

  return (
    <form
      onSubmit={submit}
      data-testid="events-join-form"
      className="flex items-center gap-2 rounded-xl bg-bg-1 border border-border-1 p-2"
    >
      <Ticket size={16} className="ml-1 flex-shrink-0 text-ink-4" />
      <input
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        placeholder="Have a code? Join an event"
        name="eventJoinCode"
        id="event-join-code"
        data-testid="events-join-input"
        className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-ink-1 placeholder:text-ink-5 focus:outline-none"
      />
      <button
        type="submit"
        disabled={joining || !code.trim()}
        data-testid="events-join-button"
        className="flex-shrink-0 rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent disabled:opacity-50"
      >
        {joining ? 'Joining…' : 'Join'}
      </button>
    </form>
  )
}
