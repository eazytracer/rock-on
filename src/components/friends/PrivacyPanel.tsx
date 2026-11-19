import { useState } from 'react'
import { ChevronDown, ChevronUp, Lock } from 'lucide-react'
import { Switch } from '../ui'
import { useToast } from '../../contexts/ToastContext'
import type { FriendRequestPolicy, MyFriendProfile } from '../../models/Friend'

const POLICIES: {
  value: FriendRequestPolicy
  label: string
  sub: string
  phrase: string
}[] = [
  {
    value: 'everyone',
    label: 'Everyone',
    sub: 'Anyone who finds you',
    phrase: 'anyone can send requests',
  },
  {
    value: 'friends_of_friends',
    label: 'Friends of friends',
    sub: 'Only people who share a friend',
    phrase: 'friends of friends can send requests',
  },
  {
    value: 'code_only',
    label: 'Code only',
    sub: 'Only with your code or QR',
    phrase: 'code only',
  },
]

/**
 * Your friend privacy as one status line ("Findable · anyone can send
 * requests"). Tap to roll open the Findable switch and who can send requests.
 * Saves on each change.
 */
export function PrivacyPanel({
  profile,
  onSave,
}: {
  profile: MyFriendProfile | null
  onSave: (changes: {
    discoverable?: boolean
    policy?: FriendRequestPolicy
  }) => Promise<void>
}) {
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const findable = !!profile?.discoverable
  const policy = POLICIES.find(p => p.value === profile?.policy) ?? POLICIES[0]

  const save = async (changes: Parameters<typeof onSave>[0]) => {
    try {
      await onSave(changes)
    } catch {
      showToast("That didn't save. Try again.", 'error')
    }
  }

  return (
    <div data-testid="friends-privacy">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        disabled={!profile}
        className="flex items-center gap-3 w-full min-h-14 py-2 pl-4 pr-3 text-left disabled:opacity-60"
        data-testid="friends-privacy-toggle"
      >
        <Lock size={18} className="text-ink-3 shrink-0" />
        <span className="flex-1 min-w-0">
          <b
            className="block text-[15px] font-semibold text-ink-1"
            data-testid="friends-privacy-status"
          >
            {findable ? 'Findable' : 'Not findable'} · {policy.phrase}
          </b>
          <small className="block text-[12.5px] text-ink-3">
            Who can find and add you
          </small>
        </span>
        {open ? (
          <ChevronUp size={18} className="text-ink-3" />
        ) : (
          <ChevronDown size={18} className="text-ink-3" />
        )}
      </button>

      {open && (
        <div data-testid="friends-privacy-panel">
          <div className="flex items-center gap-3 min-h-14 py-2 pl-4 pr-3 border-t border-divider">
            <span className="flex-1 min-w-0">
              <b className="block text-[15px] font-semibold text-ink-1">
                Findable by name
              </b>
              <small className="block text-[12.5px] text-ink-3">
                {findable
                  ? 'People can find you in search'
                  : 'Only your code or QR finds you'}
              </small>
            </span>
            <Switch
              checked={findable}
              onChange={v => void save({ discoverable: v })}
              label="Findable by name"
              data-testid="friends-discoverable-toggle"
            />
          </div>
          <p className="px-4 pt-3 pb-1 font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3 border-t border-divider">
            Who can send requests
          </p>
          <div
            role="radiogroup"
            aria-label="Who can send requests"
            className="pb-1.5"
            data-testid="friends-policy"
          >
            {POLICIES.map(p => {
              const on = p.value === policy.value
              return (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => !on && void save({ policy: p.value })}
                  className="flex items-center gap-3 w-full min-h-[52px] py-1.5 pl-4 pr-4 text-left hover:bg-bg-3"
                  data-testid={`friends-policy-${p.value}`}
                >
                  <span className="flex-1 min-w-0">
                    <b className="block text-[14.5px] font-semibold text-ink-1">
                      {p.label}
                    </b>
                    <small className="block text-[12.5px] text-ink-3">
                      {p.sub}
                    </small>
                  </span>
                  <span
                    aria-hidden
                    className={`w-[22px] h-[22px] rounded-full shrink-0 ${
                      on
                        ? 'border-[7px] border-accent bg-on-accent'
                        : 'border-2 border-border-1'
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
