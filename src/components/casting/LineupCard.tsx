import type { ReactNode } from 'react'
import {
  Hand,
  ChevronDown,
  CheckCircle2,
  GripVertical,
  Music,
  Users,
  Star,
} from 'lucide-react'
import type { KebabMenuItem } from '../common/KebabMenu'
import { TuningTag } from '../common/MetaPill'
import type { BandRole, CastingAssignment } from '../../models/Casting'
import type { LineupItem, RaisedHand } from '../../models/Event'

/**
 * dnd-kit's `useSortable` listeners map — the concrete type
 * (`SyntheticListenerMap`) isn't re-exported, so we match its public shape
 * (a record of DOM event handlers keyed by handler name), as QueueSongRow does.
 */
export type DragHandleListeners = Record<string, (event: unknown) => void>

interface LineupCardProps {
  item: LineupItem
  /** The event's default part set (guitar/bass/drums/vox/keys). */
  defaultParts: BandRole[]
  /** All assignments for the event (filtered to this slot internally). */
  casting: CastingAssignment[]
  /** Raised hands for the event (filtered to this slot internally). */
  hands: RaisedHand[]
  selected: boolean
  onSelect: () => void
  /** Casting panel, rendered inside the card's border when selected. */
  children?: ReactNode
  /**
   * Manager-only drag handle listeners (from useSortable). When present a grip
   * shows inline in the row header and the card is reorderable; guests never
   * see it.
   */
  dragHandleListeners?: DragHandleListeners
  /** Manager-only card actions (Edit / Remove) shown in the expanded panel. */
  actions?: KebabMenuItem[]
  /** Resolved name of whoever added/requested the song ("Added by {name}"). */
  ownerName?: string
  /** The logged-in user's id — highlights parts they're cast on ("You're on"). */
  currentUserId?: string
}

/**
 * One song in the event Lineup, as a compact single-row card (EC4 #3 — a
 * vertical column of numbered rows like the setlist builder, so a host can see
 * as many songs as possible). The header is ONE line: [grip] · title · artist ·
 * hands tally · cast count · chevron. The grip sits inline beside the title
 * (never on its own row); clicking the title toggles the embedded cast panel.
 * Manager Edit/Remove actions live inside that expanded panel (not a row kebab),
 * keeping the collapsed row uncluttered. Source pills are retired (EC4 #5).
 * An optional second meta line shows "Added by {name}" plus the per-song
 * tuning (colored) + key when present.
 */
export function LineupCard({
  item,
  defaultParts,
  casting,
  hands,
  selected,
  onSelect,
  children,
  dragHandleListeners,
  actions,
  ownerName,
  currentUserId,
}: LineupCardProps) {
  const slotCasting = casting.filter(c => c.slotId === item.id)
  const total = defaultParts.length
  const castCount = defaultParts.filter(p =>
    slotCasting.some(c => c.roleKey === p.key && c.isPrimary)
  ).length
  const fullyCast = castCount === total && total > 0
  const handsTotal = hands.filter(
    h => h.lineupItemId === item.id && h.status === 'raised'
  ).length
  // Parts the logged-in user is cast on — so they can spot "what's next for me".
  const myParts = currentUserId
    ? defaultParts
        .filter(p =>
          slotCasting.some(
            c =>
              c.roleKey === p.key && c.isPrimary && c.memberId === currentUserId
          )
        )
        .map(p => p.label)
    : []
  const iAmOn = myParts.length > 0

  return (
    <div
      className={`flex flex-col rounded-xl border bg-bg-1 transition-colors ${
        // Songs you're on get an orange (accent) border. The filled row-shade
        // and the top/bottom glow are both reserved for the future live
        // "up next / now playing" tracker (README §8).
        selected || iAmOn
          ? 'border-accent'
          : 'border-border-1 hover:border-border-2'
      }`}
    >
      {/* Single-row header — grip + kebab are inline siblings of the title
          button (not nested inside it, so their clicks don't toggle the
          panel). Manager controls are simply absent for guests. */}
      <div className="flex items-center gap-2.5 px-3 py-3 sm:py-2">
        {dragHandleListeners && (
          <span
            {...dragHandleListeners}
            data-testid={`lineup-drag-${item.id}`}
            className="cursor-grab touch-none text-border-2 hover:text-ink-4 active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical size={15} />
          </span>
        )}
        <button
          type="button"
          onClick={onSelect}
          data-testid={`lineup-card-${item.id}`}
          aria-pressed={selected}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate text-base font-semibold text-ink-1">
                {item.displayTitle}
              </span>
              <span className="truncate text-sm text-ink-4">
                {item.displayArtist}
              </span>
            </span>
            {(iAmOn || ownerName || item.tuning || item.key) && (
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-4">
                {iAmOn && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 font-semibold text-info"
                    data-testid={`lineup-you-${item.id}`}
                  >
                    <Star size={10} className="flex-shrink-0" /> You&rsquo;re on
                    · {myParts.join(', ')}
                  </span>
                )}
                {/* On the narrowest breakpoint "Added by" moves into the
                    expanded body (below) to keep the collapsed row uncluttered. */}
                {ownerName && (
                  <span
                    className="hidden truncate sm:inline"
                    data-testid={`lineup-owner-${item.id}`}
                  >
                    Added by {ownerName}
                  </span>
                )}
                {item.tuning && (
                  <TuningTag
                    tuning={item.tuning}
                    className="text-[11px]"
                    data-testid={`lineup-tuning-${item.id}`}
                  />
                )}
                {item.key && (
                  <span
                    className="inline-flex items-center gap-1 font-medium text-ink-3"
                    data-testid={`lineup-key-${item.id}`}
                  >
                    <Music size={12} className="flex-shrink-0" /> {item.key}
                  </span>
                )}
              </span>
            )}
          </span>
          {/* Trailing metrics — evenly spaced (hands · cast count · casting ·
              chevron). Manager Edit/Remove live in the expanded body, not here. */}
          <span className="flex flex-shrink-0 items-center gap-2.5">
            {handsTotal > 0 && (
              <span
                data-testid={`lineup-hands-${item.id}`}
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-info-soft px-2 py-0.5 text-[11px] font-semibold text-info"
              >
                <Hand size={11} /> {handsTotal}
              </span>
            )}
            <span
              data-testid={`lineup-cast-count-${item.id}`}
              className={`inline-flex flex-shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${
                fullyCast
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-accent/30 bg-accent-soft text-accent'
              }`}
            >
              {fullyCast && <CheckCircle2 size={12} />}
              {castCount}/{total}
            </span>
            {/* Casting affordance — labels what the expand opens. Icon always;
                "Casting" text only when there's room. */}
            <span
              className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] text-ink-4"
              data-testid={`lineup-casting-${item.id}`}
            >
              <Users size={13} />
              <span className="hidden sm:inline">Casting</span>
            </span>
            <ChevronDown
              size={16}
              className={`flex-shrink-0 text-ink-4 transition-transform ${
                selected ? 'rotate-180' : ''
              }`}
            />
          </span>
        </button>
      </div>

      {selected && children && (
        <div
          className="border-t border-border-1 px-3.5 pb-3.5 pt-3"
          data-testid={`lineup-card-body-${item.id}`}
        >
          {ownerName && (
            <div
              className="mb-2 pt-1 text-[11px] text-ink-4 sm:hidden"
              data-testid={`lineup-owner-expanded-${item.id}`}
            >
              Added by {ownerName}
            </div>
          )}
          {children}
          {actions && actions.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-1 pt-3">
              {actions.map(action => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    data-testid={action['data-testid']}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      action.variant === 'danger'
                        ? 'text-danger hover:bg-danger/10'
                        : 'text-ink-3 hover:bg-bg-3 hover:text-white'
                    }`}
                  >
                    {Icon && <Icon size={15} />}
                    {action.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
