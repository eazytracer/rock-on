import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PartyPopper } from 'lucide-react'
import { EventService } from '../services/EventService'
import { useToast } from '../contexts/ToastContext'
import { BackLink } from '../components/common/BackLink'
import { DatePicker } from '../components/common/DatePicker'
import { TimePickerDropdown } from '../components/common/TimePickerDropdown'
import { Eyebrow } from '../components/common/Eyebrow'
import {
  formatDateForInput,
  parseDateInputAsLocal,
  parseTime12Hour,
} from '../utils/dateHelpers'

/**
 * Create an event (mobile-redesign-port).
 * Create-only, full page (consistent with /shows/new & /practices/new — not a
 * modal). Editing an event's details is done inline on the event detail header
 * (ScheduleMetaRow / InlineStatusBadge), not here. Captures name, date, start
 * time (+ optional end time), venue — combining date + time like ShowsPage.
 * No fields are pre-opened; the host fills them in order.
 */
export function EventCreatePage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [venue, setVenue] = useState('')
  const [date, setDate] = useState(formatDateForInput(new Date()))
  const [time, setTime] = useState('7:00 PM')
  const [endTime, setEndTime] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    // Combine date + time exactly like ShowsPage (local-timezone safe).
    const baseDate = parseDateInputAsLocal(date)
    const scheduledDate = time ? parseTime12Hour(time, baseDate) : baseDate
    const end = endTime ? parseTime12Hour(endTime, baseDate) : undefined

    const id = await EventService.createEvent({
      name,
      venue,
      scheduledDate,
      endTime: end,
    })
    setSaving(false)
    if (id) {
      showToast('Event created', 'success')
      // Replace so Back from the new event skips the create form → real referrer.
      navigate(`/events/${id}`, { replace: true })
    } else {
      showToast('Could not create event', 'error')
    }
  }

  return (
    <div data-testid="event-create-page" className="mx-auto max-w-lg">
      <BackLink
        to="/calendar?filter=events"
        label="Events"
        className="mb-4"
        data-testid="event-create-back"
      />
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Eyebrow className="mb-1.5">Start time</Eyebrow>
            <TimePickerDropdown
              value={time}
              onChange={setTime}
              name="eventTime"
              id="event-time-input"
              data-testid="event-create-time"
              placeholder="Start time"
            />
          </div>
          <div>
            <Eyebrow className="mb-1.5">End time (optional)</Eyebrow>
            <TimePickerDropdown
              value={endTime}
              onChange={setEndTime}
              name="eventEndTime"
              id="event-end-time-input"
              data-testid="event-create-end-time"
              placeholder="End time"
            />
          </div>
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
          onClick={save}
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
