import { useMemo, useRef, useState } from 'react'
import { Check, Hand, X } from 'lucide-react'
import { useCasting } from '../../hooks/useCasting'
import { useEventParticipants } from '../../hooks/useEvents'
import { useToast } from '../../contexts/ToastContext'
import { Avatar } from '../common/Avatar'
import { Eyebrow } from '../common/Eyebrow'
import { SlideOutTray } from '../common/SlideOutTray'
import { INSTRUMENT_META, FALLBACK_INSTRUMENT } from './instrumentMeta'
import type { BandRole } from '../../models/Casting'
import type { LineupItem, RaisedHand } from '../../models/Event'

interface EventCastGridProps {
  eventId: string
  bandId?: string
  lineup: LineupItem[]
  hands: RaisedHand[]
  isManager: boolean
  currentUserId?: string
  /** Resolve a raised hand once it's been cast from the sheet (accept). */
  onResolveHand?: (handId: string, accept: boolean) => void | Promise<void>
}

interface ActiveCell {
  item: LineupItem
  role: BandRole
}

/**
 * Grid view (host-only) for event casting: songs × instruments matrix.
 * Alternate to the per-song List view (`SongCastPanel`) — same underlying
 * `useCasting` + `useEventParticipants` data, just laid out for a fast scan
 * of "what's still open" across the whole lineup. Tapping a cell opens a
 * themed bottom sheet to cast/unassign for that (song, instrument) pair.
 */
export function EventCastGrid({
  eventId,
  bandId,
  lineup,
  hands,
  isManager,
  onResolveHand,
}: EventCastGridProps) {
  const { showToast } = useToast()
  const { defaultParts, casting, loading, assign, unassign } = useCasting(
    'event',
    eventId,
    bandId
  )
  const { participants } = useEventParticipants(eventId)
  const assignablePeople = useMemo(
    () => participants.map(p => ({ id: p.userId, name: p.name })),
    [participants]
  )

  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  // Kept so the sheet's content doesn't blank out while it's sliding closed.
  const lastCellRef = useRef<ActiveCell | null>(null)
  if (activeCell) lastCellRef.current = activeCell
  const sheetCell = activeCell ?? lastCellRef.current

  const [freeText, setFreeText] = useState('')

  const totalSlots = defaultParts.length * lineup.length
  const filledSlots = lineup.reduce(
    (sum, item) =>
      sum +
      defaultParts.filter(part =>
        casting.some(
          c => c.slotId === item.id && c.roleKey === part.key && c.isPrimary
        )
      ).length,
    0
  )
  const progressPct =
    totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0

  const doAssign = async (
    item: LineupItem,
    role: BandRole,
    person: { memberId?: string; memberName: string }
  ) => {
    const res = await assign({
      contextType: 'event',
      contextId: eventId,
      slotId: item.id,
      bandId,
      songId: item.songId,
      roleKey: role.key,
      memberId: person.memberId,
      memberName: person.memberName,
      isPrimary: true,
    })
    if (!res.ok) showToast(res.error ?? 'Could not assign', 'error')
    return res
  }

  const acceptHand = async (
    item: LineupItem,
    role: BandRole,
    h: RaisedHand
  ) => {
    const res = await doAssign(item, role, {
      memberId: h.userId,
      memberName: h.userName,
    })
    if (res.ok) await onResolveHand?.(h.id, true)
  }

  const submitFreeText = async (item: LineupItem, role: BandRole) => {
    const name = freeText.trim()
    if (!name) return
    setFreeText('')
    await doAssign(item, role, { memberName: name })
  }

  if (loading) {
    return <div className="py-2 text-xs text-ink-5">Loading casting…</div>
  }

  // Sheet data — derived from the currently (or most recently) open cell.
  const sheetAssignments = sheetCell
    ? casting.filter(
        c =>
          c.slotId === sheetCell.item.id &&
          c.roleKey === sheetCell.role.key &&
          c.isPrimary
      )
    : []
  const sheetHands = sheetCell
    ? hands.filter(
        h =>
          h.lineupItemId === sheetCell.item.id &&
          h.roleKey === sheetCell.role.key &&
          h.status === 'raised'
      )
    : []
  const takenIds = new Set([
    ...sheetHands.map(h => h.userId),
    ...sheetAssignments.map(a => a.memberId).filter((id): id is string => !!id),
  ])
  const sheetOthers = assignablePeople.filter(p => !takenIds.has(p.id))

  return (
    <div
      className="rounded-lg bg-bg-2 border border-border-1 p-3"
      data-testid="event-cast-grid"
    >
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <Eyebrow>Casting</Eyebrow>
          <span
            className="font-mono text-[10px] text-ink-4"
            data-testid="grid-cast-progress"
          >
            {filledSlots} of {totalSlots} parts · {progressPct}%
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-bg-3">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progressPct}%` }}
            data-testid="grid-cast-progress-bar"
          />
        </div>
      </div>

      <div className="relative">
        <div className="overflow-x-auto custom-scrollbar-thin">
          <div className="flex w-max flex-col">
            {/* Header row */}
            <div className="flex">
              <div className="sticky left-0 z-10 w-36 flex-shrink-0 bg-bg-2 px-2 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-5">
                  Song
                </span>
              </div>
              {defaultParts.map(part => {
                const instrument =
                  INSTRUMENT_META[part.key] ?? FALLBACK_INSTRUMENT
                const Icon = instrument.Icon
                return (
                  <div
                    key={part.key}
                    className="flex w-14 flex-shrink-0 flex-col items-center gap-0.5 px-1 py-1.5"
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-md"
                      style={{
                        color: instrument.color,
                        backgroundColor: `color-mix(in srgb, ${instrument.color} 16%, transparent)`,
                      }}
                      aria-hidden="true"
                    >
                      <Icon size={12} />
                    </span>
                    <span className="text-[9px] font-medium text-ink-4">
                      {part.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Body rows */}
            {lineup.map(item => (
              <div
                key={item.id}
                className="flex border-t border-border-1"
                data-testid={`cast-grid-row-${item.id}`}
              >
                <div className="sticky left-0 z-10 flex w-36 flex-shrink-0 items-center bg-bg-2 px-2 py-1.5">
                  <span className="truncate text-xs font-medium text-ink-1">
                    {item.displayTitle}
                  </span>
                </div>
                {defaultParts.map(role => {
                  const assignment = casting.find(
                    c =>
                      c.slotId === item.id &&
                      c.roleKey === role.key &&
                      c.isPrimary
                  )
                  const handCount = hands.filter(
                    h =>
                      h.lineupItemId === item.id &&
                      h.roleKey === role.key &&
                      h.status === 'raised'
                  ).length
                  const testId = `cast-cell-${item.id}-${role.key}`
                  const content = assignment ? (
                    <Avatar
                      label={assignment.memberName ?? 'Member'}
                      title={assignment.memberName ?? 'Member'}
                      size="xs"
                    />
                  ) : handCount > 0 ? (
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-soft px-1 text-[11px] font-semibold text-accent">
                      {handCount}
                    </span>
                  ) : (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-bg-4"
                      aria-hidden="true"
                    />
                  )
                  return isManager ? (
                    <button
                      key={role.key}
                      type="button"
                      onClick={() => setActiveCell({ item, role })}
                      data-testid={testId}
                      aria-label={`${role.label} · ${item.displayTitle}`}
                      className="flex w-14 flex-shrink-0 items-center justify-center py-1.5 hover:bg-bg-3"
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      key={role.key}
                      data-testid={testId}
                      className="flex w-14 flex-shrink-0 items-center justify-center py-1.5"
                    >
                      {content}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        {/* Edge fade — hints there's more to scroll horizontally. */}
        <div
          className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-bg-2 to-transparent"
          aria-hidden="true"
        />
      </div>

      {isManager && (
        <SlideOutTray
          isOpen={!!activeCell}
          onClose={() => setActiveCell(null)}
          title={
            sheetCell
              ? `${sheetCell.role.label} · ${sheetCell.item.displayTitle}`
              : ''
          }
          position="bottom"
          data-testid="cast-cell-sheet"
        >
          {sheetCell && (
            <div className="flex flex-col gap-4 px-6 py-4">
              {sheetHands.length > 0 && (
                <div>
                  <Eyebrow className="mb-2">Raised hands</Eyebrow>
                  <div className="flex flex-col gap-1.5">
                    {sheetHands.map(h => (
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
                          onClick={() =>
                            void acceptHand(sheetCell.item, sheetCell.role, h)
                          }
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

              {sheetAssignments.length > 0 && (
                <div>
                  <Eyebrow className="mb-2">Currently cast</Eyebrow>
                  <div className="flex flex-col gap-1.5">
                    {sheetAssignments.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 rounded-lg bg-bg-3 px-2.5 py-2"
                      >
                        <Avatar label={a.memberName ?? 'Member'} size="xs" />
                        <span className="flex-1 truncate text-sm text-ink-1">
                          {a.memberName ?? 'Member'}
                        </span>
                        <button
                          onClick={() => void unassign(a.id)}
                          aria-label="Remove"
                          data-testid={`cast-unassign-${a.id}`}
                          className="rounded p-1 text-ink-5 hover:text-danger"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Eyebrow className="mb-2">Everyone else</Eyebrow>
                {sheetOthers.length === 0 ? (
                  <p className="text-xs text-ink-5">No one else to cast yet.</p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar-thin">
                    {sheetOthers.map(p => (
                      <button
                        key={p.id}
                        onClick={() =>
                          void doAssign(sheetCell.item, sheetCell.role, {
                            memberId: p.id,
                            memberName: p.name,
                          })
                        }
                        data-testid={`cast-sheet-person-${p.id}`}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-bg-3"
                      >
                        <Avatar label={p.name} size="xs" />
                        <span className="truncate text-sm text-ink-2">
                          {p.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={e => {
                  e.preventDefault()
                  void submitFreeText(sheetCell.item, sheetCell.role)
                }}
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
      )}
    </div>
  )
}
