import { useRef, useState } from 'react'
import { Check, Hand, X } from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { Eyebrow } from '../common/Eyebrow'
import { SlideOutTray } from '../common/SlideOutTray'
import type { CastingAssignment } from '../../models/Casting'
import type { RaisedHand } from '../../models/Event'

interface Person {
  id: string
  name: string
}

interface CastAssignSheetProps {
  isOpen: boolean
  onClose: () => void
  /** `right` docked on desktop, `bottom` sheet on mobile. */
  position: 'right' | 'bottom'
  title: string
  currentUserId?: string
  /** People castable in this context (event participants or band members). */
  assignablePeople: Person[]
  /** Primary assignments for the open slot+role ("currently cast"). */
  assignments: CastingAssignment[]
  /** Raised hands for the open slot+role (event only). */
  hands?: RaisedHand[]
  onAssign: (person: {
    memberId?: string
    memberName: string
  }) => void | Promise<void>
  onUnassign: (assignmentId: string) => void | Promise<void>
  onAcceptHand?: (hand: RaisedHand) => void | Promise<void>
  'data-testid'?: string
}

/**
 * Shared cast-assign sheet used by BOTH the lineup List view (SongCastPanel) and
 * the Grid view (EventCastGrid). Multi-assign: picking a person casts them but
 * keeps the sheet open (the "Currently cast" section updates); the manager
 * dismisses via the backdrop / close button when done. On desktop it docks to
 * the right; on mobile it's a bottom-sheet, so a role near the screen bottom is
 * never hidden behind the nav bar.
 */
export function CastAssignSheet({
  isOpen,
  onClose,
  position,
  title,
  currentUserId,
  assignablePeople,
  assignments,
  hands = [],
  onAssign,
  onUnassign,
  onAcceptHand,
  'data-testid': testId = 'cast-assign-sheet',
}: CastAssignSheetProps) {
  const [freeText, setFreeText] = useState('')

  const raised = hands.filter(h => h.status === 'raised')
  const takenIds = new Set<string>([
    ...raised.map(h => h.userId),
    ...assignments.map(a => a.memberId).filter((id): id is string => !!id),
  ])
  // One flat list of everyone still castable — the current user included and
  // just flagged with a "You" pill (no separate callout), sorted to the top.
  const notCast = assignablePeople.filter(p => !takenIds.has(p.id))
  const people = currentUserId
    ? [
        ...notCast.filter(p => p.id === currentUserId),
        ...notCast.filter(p => p.id !== currentUserId),
      ]
    : notCast

  // Cache the last-open view model so the sheet doesn't blank out while it
  // slides closed (the parent drops its open-role/cell data on close).
  const viewRef = useRef<{
    title: string
    raised: RaisedHand[]
    assignments: CastingAssignment[]
    people: Person[]
  } | null>(null)
  if (isOpen) viewRef.current = { title, raised, assignments, people }
  const view = isOpen ? { title, raised, assignments, people } : viewRef.current

  const submitFreeText = (e: React.FormEvent) => {
    e.preventDefault()
    const name = freeText.trim()
    if (!name) return
    setFreeText('')
    void onAssign({ memberName: name })
  }

  return (
    <SlideOutTray
      isOpen={isOpen}
      onClose={onClose}
      title={view?.title ?? ''}
      position={position}
      data-testid={testId}
    >
      {view && (
        <div className="flex flex-col gap-4 px-6 py-4">
          {/* Who's on now — kept at the very top so it's the first thing seen. */}
          {view.assignments.length > 0 && (
            <div>
              <Eyebrow className="mb-2">Currently cast</Eyebrow>
              <div className="flex flex-col gap-1.5">
                {view.assignments.map(a => (
                  <div
                    key={a.id}
                    data-testid={`cast-sheet-cast-${a.id}`}
                    className="flex items-center gap-2 rounded-lg bg-bg-3 px-2.5 py-2"
                  >
                    <Avatar label={a.memberName ?? 'Member'} size="xs" />
                    <span className="flex-1 truncate text-sm text-ink-1">
                      {a.memberName ?? 'Member'}
                    </span>
                    {a.memberId === currentUserId && (
                      <span className="flex-shrink-0 rounded-full bg-info px-2 py-0.5 text-[10px] font-semibold text-white">
                        You
                      </span>
                    )}
                    <button
                      onClick={() => void onUnassign(a.id)}
                      aria-label="Remove"
                      data-testid={`cast-unassign-${a.id}`}
                      className="rounded p-1.5 text-ink-5 hover:text-danger [@media(pointer:coarse)]:p-2"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view.raised.length > 0 && onAcceptHand && (
            <div>
              <Eyebrow className="mb-2">Raised hands</Eyebrow>
              <div className="flex flex-col gap-1.5">
                {view.raised.map(h => (
                  <div
                    key={h.id}
                    data-testid={`cast-sheet-hand-${h.userId}`}
                    className="flex items-center gap-2 rounded-lg border border-info bg-info-soft px-2.5 py-2"
                  >
                    <Avatar label={h.userName} size="xs" />
                    <span className="flex-1 truncate text-sm text-info">
                      {h.userName}
                    </span>
                    <Hand size={13} className="text-info" />
                    <button
                      onClick={() => void onAcceptHand(h)}
                      data-testid={`cast-sheet-hand-cast-${h.userId}`}
                      className="inline-flex items-center gap-1 rounded-full bg-info px-2 py-1 text-[11px] font-semibold text-white hover:brightness-110"
                    >
                      <Check size={12} /> Cast
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* One flat roster — tap to cast. You're in the list too, flagged only
              by a small "You" pill (no separate section, no heavy highlight). */}
          <div>
            <Eyebrow className="mb-2">Cast a part</Eyebrow>
            {view.people.length === 0 ? (
              <p className="text-xs text-ink-5">No one left to cast.</p>
            ) : (
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto custom-scrollbar-thin">
                {view.people.map(p => (
                  <button
                    key={p.id}
                    onClick={() =>
                      void onAssign({ memberId: p.id, memberName: p.name })
                    }
                    data-testid={`cast-sheet-person-${p.id}`}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-bg-3"
                  >
                    <Avatar label={p.name} size="xs" />
                    <span className="truncate text-sm text-ink-1">
                      {p.name}
                    </span>
                    {p.id === currentUserId && (
                      <span className="ml-auto flex-shrink-0 rounded-full bg-info px-2 py-0.5 text-[10px] font-semibold text-white">
                        You
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Free-text: cast someone who can't/won't join the app. */}
          <form
            onSubmit={submitFreeText}
            className="flex items-center gap-2 border-t border-border-1 pt-3"
          >
            <input
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="Type a name…"
              name="freeTextName"
              id="cast-sheet-freetext"
              data-testid="cast-sheet-freetext-input"
              className="min-w-0 flex-1 rounded-lg bg-bg-3 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-5 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!freeText.trim()}
              data-testid="cast-sheet-freetext-add"
              className="flex-shrink-0 rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </SlideOutTray>
  )
}
