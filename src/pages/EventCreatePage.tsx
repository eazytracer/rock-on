import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, PartyPopper } from 'lucide-react'
import { EventService } from '../services/EventService'
import { useToast } from '../contexts/ToastContext'
import { DatePicker } from '../components/common/DatePicker'
import { Eyebrow } from '../components/common/Eyebrow'
import { formatDateForInput, parseDateInputAsLocal } from '../utils/dateHelpers'

/**
 * Create Event (mobile-redesign-port).
 * Minimal host-an-event form: name, date (custom DatePicker), venue.
 */
export function EventCreatePage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [venue, setVenue] = useState('')
  const [date, setDate] = useState(formatDateForInput(new Date()))
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!name.trim()) return
    setSaving(true)
    const id = await EventService.createEvent({
      name,
      venue,
      scheduledDate: parseDateInputAsLocal(date),
    })
    setSaving(false)
    if (id) {
      showToast('Event created', 'success')
      navigate(`/events/${id}`)
    } else {
      showToast('Could not create event', 'error')
    }
  }

  return (
    <div data-testid="event-create-page">
      <button
        onClick={() => navigate('/events')}
        data-testid="event-create-back"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink-1"
      >
        <ArrowLeft size={16} /> Events
      </button>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-1">
        <PartyPopper size={22} className="text-accent" /> Host an event
      </h1>

      <div className="mt-5 flex flex-col gap-4">
        <div>
          <Eyebrow className="mb-1.5">Event name</Eyebrow>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Backyard Summer Jam"
            name="eventName"
            id="event-name-input"
            data-testid="event-create-name"
            className="w-full rounded-lg bg-bg-1 border border-border-1 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-5 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <Eyebrow className="mb-1.5">Date</Eyebrow>
          <DatePicker
            value={date}
            onChange={setDate}
            data-testid="event-create-date"
          />
        </div>

        <div>
          <Eyebrow className="mb-1.5">Venue</Eyebrow>
          <input
            value={venue}
            onChange={e => setVenue(e.target.value)}
            placeholder="Where's it happening?"
            name="eventVenue"
            id="event-venue-input"
            data-testid="event-create-venue"
            className="w-full rounded-lg bg-bg-1 border border-border-1 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-5 focus:border-accent focus:outline-none"
          />
        </div>

        <button
          onClick={create}
          disabled={saving || !name.trim()}
          data-testid="event-create-submit"
          className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create event
        </button>
      </div>
    </div>
  )
}
