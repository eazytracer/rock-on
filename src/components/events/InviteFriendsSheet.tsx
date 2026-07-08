import { useMemo, useState } from 'react'
import { UserPlus, Check } from 'lucide-react'
import { useFriends } from '../../hooks/useFriends'
import { useToast } from '../../contexts/ToastContext'
import { EventService } from '../../services/EventService'
import { Avatar } from '../common/Avatar'
import { SlideOutTray } from '../common/SlideOutTray'

interface InviteFriendsSheetProps {
  eventId: string
  /** User ids already on the event — filtered out of the invite list. */
  participantIds: Set<string>
  /** Refetch participants after a successful invite. */
  onInvited: () => void | Promise<void>
  /** Tray placement — bottom-sheet on mobile, right-docked on desktop. */
  position?: 'right' | 'bottom'
}

/**
 * Host-only "Invite friends" control for the event People tab. Multi-select from
 * the host's friends → `event_participants` (guest, RSVP pending). Uses the
 * already-reviewed `event_participants_insert_self` manager branch + the existing
 * `users_select_event_coparticipant` name visibility — no schema/RLS change.
 */
export function InviteFriendsSheet({
  eventId,
  participantIds,
  onInvited,
  position = 'bottom',
}: InviteFriendsSheetProps) {
  const { friends, loading } = useFriends()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [inviting, setInviting] = useState(false)

  const invitable = useMemo(
    () => friends.filter(f => !participantIds.has(f.userId)),
    [friends, participantIds]
  )

  const toggle = (userId: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })

  const close = () => {
    setOpen(false)
    setSelected(new Set())
  }

  const submit = async () => {
    if (selected.size === 0) return
    setInviting(true)
    const res = await EventService.inviteFriends(eventId, [...selected])
    setInviting(false)
    if (!res.ok) {
      showToast(res.error ?? 'Could not send invites', 'error')
      return
    }
    showToast(
      selected.size === 1
        ? 'Friend invited'
        : `${selected.size} friends invited`,
      'success'
    )
    await onInvited()
    close()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="event-invite-friends-button"
        className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent hover:brightness-110"
      >
        <UserPlus size={15} /> Invite friends
      </button>

      <SlideOutTray
        isOpen={open}
        onClose={close}
        title="Invite friends"
        position={position}
        data-testid="invite-friends-sheet"
      >
        <div className="flex flex-col gap-4 px-6 py-4">
          {loading ? (
            <p className="text-sm text-ink-5">Loading friends…</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-ink-5">
              Add friends first — you can invite them to events from here.
            </p>
          ) : invitable.length === 0 ? (
            <p className="text-sm text-ink-5">
              All your friends are already on this event.
            </p>
          ) : (
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto custom-scrollbar-thin">
              {invitable.map(f => {
                const isSel = selected.has(f.userId)
                return (
                  <button
                    key={f.userId}
                    onClick={() => toggle(f.userId)}
                    data-testid={`invite-friend-${f.userId}`}
                    aria-pressed={isSel}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left ${
                      isSel ? 'bg-accent-soft' : 'hover:bg-bg-3'
                    }`}
                  >
                    <Avatar label={f.name} size="xs" />
                    <span className="flex-1 truncate text-sm text-ink-1">
                      {f.name}
                    </span>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        isSel
                          ? 'border-accent bg-accent text-white'
                          : 'border-border-2 text-transparent'
                      }`}
                    >
                      <Check size={12} />
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {invitable.length > 0 && (
            <button
              onClick={() => void submit()}
              disabled={selected.size === 0 || inviting}
              data-testid="invite-friends-submit"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {selected.size === 0
                ? 'Invite'
                : `Invite ${selected.size} ${selected.size === 1 ? 'friend' : 'friends'}`}
            </button>
          )}
        </div>
      </SlideOutTray>
    </>
  )
}
