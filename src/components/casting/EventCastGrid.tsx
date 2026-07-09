import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Hand, X, GripVertical, Music, Star } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCasting } from '../../hooks/useCasting'
import { useEventParticipants } from '../../hooks/useEvents'
import { useViewport } from '../../hooks/useResponsive'
import { useToast } from '../../contexts/ToastContext'
import { Avatar } from '../common/Avatar'
import { Eyebrow } from '../common/Eyebrow'
import { SlideOutTray } from '../common/SlideOutTray'
import { TuningTag } from '../common/MetaPill'
import { INSTRUMENT_META, FALLBACK_INSTRUMENT } from './instrumentMeta'
import type { BandRole } from '../../models/Casting'
import type { LineupItem, RaisedHand } from '../../models/Event'

// Column widths — compact on mobile, roomier on desktop (kept in sync between
// the header row and the body cells via these shared class strings).
const SONG_COL = 'w-32 sm:w-40 lg:w-56'
const PART_COL = 'w-14 lg:w-[5.5rem]'

// Concise column labels — band roles can be long ("Lead Vocals"); the grid
// header stays space-efficient (falls back to the role's own label).
const SHORT_PART_LABEL: Record<string, string> = {
  guitar: 'Guitar',
  bass: 'Bass',
  drums: 'Drums',
  vox: 'Vox',
  lead_vocals: 'Vox',
  backing_vocals: 'BVox',
  keys: 'Keys',
  other: 'Other',
}
const shortPartLabel = (role: BandRole) =>
  SHORT_PART_LABEL[role.key] ?? role.label

interface EventCastGridProps {
  eventId: string
  bandId?: string
  lineup: LineupItem[]
  hands: RaisedHand[]
  isManager: boolean
  currentUserId?: string
  /** Guests may raise/withdraw their own hand by tapping an open cell. */
  canRaiseHand?: boolean
  onRaiseHand?: (lineupItemId: string, roleKey: string) => void | Promise<void>
  onWithdrawHand?: (handId: string) => void | Promise<void>
  /** Resolve a raised hand once it's been cast from the sheet (accept). */
  onResolveHand?: (handId: string, accept: boolean) => void | Promise<void>
  /** Persist a new song order (manager-only drag-to-reorder of the rows). */
  onReorder?: (orderedItemIds: string[]) => void | Promise<unknown>
}

interface ActiveCell {
  item: LineupItem
  role: BandRole
}

/**
 * A single grid body row wired for drag-to-reorder. Renders via a render-prop so
 * the row `<div>` itself is the sortable node (clean transforms), with the drag
 * listeners scoped to the grip in the sticky song cell.
 */
function SortableGridRow({
  id,
  enabled,
  children,
}: {
  id: string
  enabled: boolean
  children: (args: {
    setNodeRef: (el: HTMLElement | null) => void
    style: React.CSSProperties
    attributes: DraggableAttributes
    listeners: Record<string, (event: unknown) => void> | undefined
  }) => ReactNode
}) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({ id, disabled: !enabled })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.9 : 1,
  }
  return children({
    setNodeRef,
    style,
    attributes,
    listeners: enabled
      ? (listeners as unknown as Record<string, (event: unknown) => void>)
      : undefined,
  })
}

/**
 * Grid view for event casting: songs × instruments matrix. Alternate to the
 * per-song List view (`SongCastPanel`) — same underlying `useCasting` +
 * `useEventParticipants` data, laid out for a fast scan of "what's still open"
 * across the whole lineup. Tapping a cell opens a themed sheet to cast/unassign.
 * Managers can drag the song rows to reorder the lineup (persisted via onReorder).
 */
export function EventCastGrid({
  eventId,
  bandId,
  lineup,
  hands,
  isManager,
  currentUserId,
  canRaiseHand,
  onRaiseHand,
  onWithdrawHand,
  onResolveHand,
  onReorder,
}: EventCastGridProps) {
  const { showToast } = useToast()
  const { isMobile } = useViewport()
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

  const canReorder = isManager && !!onReorder
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const handleDragEnd = async (dragEvent: DragEndEvent) => {
    const { active, over } = dragEvent
    if (!over || active.id === over.id) return
    const oldIndex = lineup.findIndex(i => i.id === active.id)
    const newIndex = lineup.findIndex(i => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const orderedIds = arrayMove(lineup, oldIndex, newIndex).map(i => i.id)
    await onReorder?.(orderedIds)
  }

  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  // Kept so the sheet's content doesn't blank out while it's sliding closed.
  const lastCellRef = useRef<ActiveCell | null>(null)
  if (activeCell) lastCellRef.current = activeCell
  const sheetCell = activeCell ?? lastCellRef.current

  const [freeText, setFreeText] = useState('')

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
  // "Cast yourself" gets its own callout at the top of the sheet (not buried
  // under "Everyone else"); everyone else is the rest.
  const me = currentUserId
    ? assignablePeople.find(p => p.id === currentUserId && !takenIds.has(p.id))
    : undefined
  const sheetOthers = assignablePeople.filter(
    p => !takenIds.has(p.id) && p.id !== currentUserId
  )

  const renderCells = (item: LineupItem) =>
    defaultParts.map(role => {
      const assignments = casting.filter(
        c => c.slotId === item.id && c.roleKey === role.key && c.isPrimary
      )
      const handCount = hands.filter(
        h =>
          h.lineupItemId === item.id &&
          h.roleKey === role.key &&
          h.status === 'raised'
      ).length
      const testId = `cast-cell-${item.id}-${role.key}`
      const filled = assignments.length > 0
      const myHand = currentUserId
        ? hands.find(
            h =>
              h.lineupItemId === item.id &&
              h.roleKey === role.key &&
              h.userId === currentUserId &&
              h.status === 'raised'
          )
        : undefined
      const content = filled ? (
        <span
          className="flex items-center"
          data-testid={`cast-cell-stack-${item.id}-${role.key}`}
        >
          {assignments.slice(0, 3).map((a, i) => (
            <Avatar
              key={a.id}
              label={a.memberName ?? 'Member'}
              title={a.memberName ?? 'Member'}
              size="xs"
              className={`!h-5 !w-5 !text-[9px] ring-2 lg:!h-7 lg:!w-7 lg:!text-[11px] ${
                a.memberId === currentUserId ? 'ring-info' : 'ring-bg-2'
              } ${i ? '-ml-2' : ''}`}
            />
          ))}
          {assignments.length > 3 && (
            <span className="ml-0.5 text-[9px] font-semibold text-ink-4 lg:text-xs">
              +{assignments.length - 3}
            </span>
          )}
        </span>
      ) : myHand ? (
        // Your own raised hand — info-blue with a ring ("your cells get the blue ring").
        <span
          data-testid={`cast-cell-mine-${item.id}-${role.key}`}
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-info text-white ring-2 ring-info/40 lg:h-8 lg:min-w-8"
        >
          <Hand size={12} />
        </span>
      ) : handCount > 0 ? (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-info-soft px-1 text-[11px] font-semibold text-info lg:h-8 lg:min-w-8 lg:text-sm">
          {handCount}
        </span>
      ) : (
        <span
          className="h-1.5 w-1.5 rounded-full bg-bg-4 lg:h-2 lg:w-2"
          aria-hidden="true"
        />
      )
      if (isManager) {
        return (
          <button
            key={role.key}
            type="button"
            onClick={() => setActiveCell({ item, role })}
            data-testid={testId}
            aria-label={`${role.label} · ${item.displayTitle}`}
            className={`${PART_COL} flex flex-shrink-0 items-center justify-center py-1.5 hover:bg-bg-3 lg:py-2.5`}
          >
            {content}
          </button>
        )
      }
      // Guest: tap an open cell to raise/withdraw your own hand; filled cells inert.
      if (canRaiseHand && !filled) {
        return (
          <button
            key={role.key}
            type="button"
            onClick={() =>
              myHand
                ? void onWithdrawHand?.(myHand.id)
                : void onRaiseHand?.(item.id, role.key)
            }
            data-testid={testId}
            aria-label={`${myHand ? 'Withdraw hand' : 'Raise hand'} · ${role.label} · ${item.displayTitle}`}
            className={`${PART_COL} flex flex-shrink-0 items-center justify-center py-1.5 hover:bg-bg-3 lg:py-2.5`}
          >
            {content}
          </button>
        )
      }
      return (
        <div
          key={role.key}
          data-testid={testId}
          className={`${PART_COL} flex flex-shrink-0 items-center justify-center py-2.5 lg:py-3.5`}
        >
          {content}
        </div>
      )
    })

  return (
    <div className="space-y-2.5">
      <div
        className="w-fit max-w-full rounded-lg bg-bg-2 border border-border-1 p-4"
        data-testid="event-cast-grid"
      >
        <div className="relative">
          <div className="overflow-x-auto custom-scrollbar-thin">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={dragEvent => void handleDragEnd(dragEvent)}
            >
              <div className="flex w-max flex-col">
                {/* Header row — instrument icon above a compact label. */}
                <div className="flex">
                  <div
                    className={`${SONG_COL} sticky left-0 z-10 flex flex-shrink-0 items-end border-l-2 border-transparent bg-bg-2 px-2 py-2.5 lg:py-3.5`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-5 lg:text-xs">
                      Song
                    </span>
                  </div>
                  {defaultParts.map(part => {
                    const meta =
                      INSTRUMENT_META[part.key] ?? FALLBACK_INSTRUMENT
                    const Icon = meta.Icon
                    return (
                      <div
                        key={part.key}
                        className={`${PART_COL} flex flex-shrink-0 flex-col items-center gap-1 px-1 py-2.5 lg:py-3.5`}
                      >
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-md lg:h-6 lg:w-6"
                          style={{
                            color: meta.color,
                            backgroundColor: `color-mix(in srgb, ${meta.color} 16%, transparent)`,
                          }}
                          aria-hidden="true"
                        >
                          <Icon size={12} />
                        </span>
                        <span className="text-[10px] font-medium text-ink-4 lg:text-xs">
                          {shortPartLabel(part)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Body rows — managers can drag the song cell to reorder. */}
                <SortableContext
                  items={lineup.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                  disabled={!canReorder}
                >
                  {lineup.map(item => {
                    const iAmOnRow =
                      !!currentUserId &&
                      casting.some(
                        c =>
                          c.slotId === item.id &&
                          c.isPrimary &&
                          c.memberId === currentUserId
                      )
                    return (
                      <SortableGridRow
                        key={item.id}
                        id={item.id}
                        enabled={canReorder}
                      >
                        {({ setNodeRef, style, attributes, listeners }) => (
                          <div
                            ref={setNodeRef}
                            style={style}
                            {...attributes}
                            className={`flex border-t border-border-1 ${
                              // Songs you're on: orange (accent) row lines top &
                              // bottom. Filled shading is reserved for the future
                              // live "now playing" highlight (README §8).
                              iAmOnRow
                                ? 'shadow-[inset_0_2px_0_0_#ff7a1a,inset_0_-2px_0_0_#ff7a1a]'
                                : ''
                            }`}
                            data-testid={`cast-grid-row-${item.id}`}
                          >
                            {/* Same orange lines on the sticky (opaque) song cell
                              so they run the full width incl. the frozen title. */}
                            <div
                              className={`${SONG_COL} sticky left-0 z-10 flex flex-shrink-0 items-center gap-1.5 border-l-2 border-transparent bg-bg-2 px-2 py-2.5 lg:py-3.5 ${
                                iAmOnRow
                                  ? 'shadow-[inset_0_2px_0_0_#ff7a1a,inset_0_-2px_0_0_#ff7a1a]'
                                  : ''
                              }`}
                            >
                              {canReorder && (
                                <span
                                  {...listeners}
                                  data-testid={`cast-grid-drag-${item.id}`}
                                  className="cursor-grab touch-none text-border-2 hover:text-ink-4 active:cursor-grabbing"
                                  aria-label="Drag to reorder"
                                >
                                  <GripVertical size={14} />
                                </span>
                              )}
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-semibold text-ink-1 lg:text-base">
                                  {item.displayTitle}
                                </span>
                                {(item.tuning || item.key) && (
                                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-[10px] text-ink-4">
                                    {item.tuning && (
                                      <TuningTag
                                        tuning={item.tuning}
                                        className="text-[10px]"
                                        data-testid={`cast-grid-tuning-${item.id}`}
                                      />
                                    )}
                                    {item.key && (
                                      <span
                                        className="inline-flex items-center gap-0.5"
                                        data-testid={`cast-grid-key-${item.id}`}
                                      >
                                        <Music
                                          size={10}
                                          className="flex-shrink-0"
                                        />{' '}
                                        {item.key}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </span>
                              {iAmOnRow && (
                                <Star
                                  size={12}
                                  className="flex-shrink-0 text-accent"
                                  data-testid={`cast-grid-you-${item.id}`}
                                />
                              )}
                            </div>
                            {renderCells(item)}
                          </div>
                        )}
                      </SortableGridRow>
                    )
                  })}
                </SortableContext>
              </div>
            </DndContext>
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
            position={isMobile ? 'bottom' : 'right'}
            data-testid="cast-cell-sheet"
          >
            {sheetCell && (
              <div className="flex flex-col gap-4 px-6 py-4">
                {me && (
                  <div>
                    <Eyebrow className="mb-2">You</Eyebrow>
                    <button
                      onClick={() =>
                        void doAssign(sheetCell.item, sheetCell.role, {
                          memberId: me.id,
                          memberName: me.name,
                        })
                      }
                      data-testid="cast-sheet-you"
                      className="flex w-full items-center gap-2 rounded-lg border border-info bg-info-soft px-2.5 py-2 text-left hover:brightness-110"
                    >
                      <Avatar label={me.name} size="xs" />
                      <span className="flex-1 truncate text-sm font-medium text-info">
                        {me.name}
                      </span>
                      <span className="flex-shrink-0 rounded-full bg-info px-2 py-0.5 text-[10px] font-semibold text-white">
                        You
                      </span>
                    </button>
                  </div>
                )}
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
                    <p className="text-xs text-ink-5">
                      No one else to cast yet.
                    </p>
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
      {(canRaiseHand || isManager) && (
        <p
          className="flex items-center gap-1.5 px-1 text-xs text-ink-4"
          data-testid="event-cast-grid-hint"
        >
          <Hand size={13} className="flex-shrink-0 text-info" />
          {canRaiseHand
            ? 'Tap an open part to raise your hand — tap again to lower it.'
            : 'Tap a cell to cast or clear a part.'}
        </p>
      )}
    </div>
  )
}
