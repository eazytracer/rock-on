/**
 * Invite friends to a jam (invite_to_jam): pick friends not already in it;
 * they get a notification and the jam shows under Invited in their hub.
 */
import React, { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Sheet } from '../ui'
import { PersonAvatar } from '../friends/PersonAvatar'
import { useFriends } from '../../hooks/useFriends'

export const InviteToJamSheet: React.FC<{
  /** User ids already in the jam (joined or invited). */
  inJam: Set<string>
  busy: boolean
  onInvite: (userIds: string[]) => void
  onClose: () => void
}> = ({ inJam, busy, onInvite, onClose }) => {
  const { friends, loading } = useFriends()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const invitable = useMemo(
    () => friends.filter(f => !inJam.has(f.userId)),
    [friends, inJam]
  )
  const toggle = (id: string) =>
    setPicked(p => {
      const n = new Set(p)
      if (!n.delete(id)) n.add(id)
      return n
    })
  return (
    <Sheet
      onClose={onClose}
      title="Invite friends"
      sub="They get a notice and find the jam under Invited."
      data-testid="jam-invite-sheet"
    >
      <div className="pb-2">
        {loading ? (
          <p className="py-6 text-center text-[14px] text-ink-3">
            Loading friends…
          </p>
        ) : !invitable.length ? (
          <p
            className="py-6 text-center text-[14px] text-ink-3"
            data-testid="jam-invite-empty"
          >
            {friends.length
              ? 'All your friends are already in this jam.'
              : 'Add friends first, then invite them here.'}
          </p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto custom-scrollbar-thin -mx-1">
            {invitable.map(f => {
              const on = picked.has(f.userId)
              return (
                <button
                  key={f.userId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(f.userId)}
                  className="w-full flex items-center gap-3 min-h-14 px-2 rounded-xl text-left hover:bg-bg-3"
                  data-testid={`jam-invite-friend-${f.userId}`}
                >
                  <PersonAvatar name={f.name} color={f.color} size="sm" />
                  <span className="flex-1 min-w-0">
                    <b className="block truncate text-[15px] text-ink-1">
                      {f.name}
                    </b>
                    {f.instruments.length > 0 && (
                      <span className="block truncate text-[12.5px] text-ink-3">
                        {f.instruments.join(', ')}
                      </span>
                    )}
                  </span>
                  <span
                    className={`w-7 h-7 grid place-items-center rounded-full ${
                      on
                        ? 'bg-accent text-on-accent'
                        : 'ring-[1.5px] ring-inset ring-border-1 text-transparent'
                    }`}
                  >
                    <Check size={15} strokeWidth={3} />
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <div className="flex gap-2 pt-4">
          <Button
            size="lg"
            className="flex-1"
            onClick={onClose}
            data-testid="jam-invite-cancel"
          >
            Cancel
          </Button>
          <Button
            size="lg"
            variant="primary"
            className="flex-1"
            disabled={!picked.size || busy}
            onClick={() => onInvite([...picked])}
            data-testid="jam-invite-send"
          >
            {picked.size > 1 ? `Invite ${picked.size}` : 'Invite'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
