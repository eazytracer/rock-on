import type { ReactNode } from 'react'
import { Users, Hand, ChevronDown, CheckCircle2 } from 'lucide-react'
import { Badge } from '../common/Badge'
import type { BadgeTone } from '../../utils/tokens'
import type { BandRole, CastingAssignment } from '../../models/Casting'
import type { LineupItem, RaisedHand } from '../../models/Event'

interface LineupCardProps {
  item: LineupItem
  /** The event's default part set (guitar/bass/drums/vox/keys). */
  defaultParts: BandRole[]
  /** All assignments for the event (filtered to this slot internally). */
  casting: CastingAssignment[]
  /** Raised hands for the event (filtered to this slot internally). */
  hands: RaisedHand[]
  isManager: boolean
  selected: boolean
  sourcePill: { tone: BadgeTone; label: string }
  onSelect: () => void
  /** Casting panel, rendered inside the card's border when selected. */
  children?: ReactNode
}

/**
 * One song in the event Lineup card grid (D2), matching the mobile prototype's
 * LineupCard: song + provenance + an "N/M" pill, and a full-width CTA
 * ("Cast N open parts" / "Fully cast") that expands the shared cast panel.
 * The panel itself (SongCastPanel) owns the actual casting; this only summarises.
 */
export function LineupCard({
  item,
  defaultParts,
  casting,
  hands,
  isManager,
  selected,
  sourcePill,
  onSelect,
  children,
}: LineupCardProps) {
  const slotCasting = casting.filter(c => c.slotId === item.id)
  const total = defaultParts.length
  const castCount = defaultParts.filter(p =>
    slotCasting.some(c => c.roleKey === p.key && c.isPrimary)
  ).length
  const open = total - castCount
  const fullyCast = open === 0 && total > 0
  const handsTotal = hands.filter(
    h => h.lineupItemId === item.id && h.status === 'raised'
  ).length

  const ctaLabel = fullyCast
    ? 'Fully cast'
    : isManager
      ? `Cast ${open} open part${open === 1 ? '' : 's'}`
      : `${open} open part${open === 1 ? '' : 's'}`
  const ctaTone = fullyCast
    ? 'border-success/30 bg-success/10 text-success'
    : isManager
      ? 'border-accent/30 bg-accent-soft text-accent'
      : 'border-info/30 bg-info-soft text-info'

  return (
    <div
      className={`flex flex-col rounded-2xl bg-bg-1 border transition-colors ${
        selected ? 'border-accent' : 'border-border-1 hover:border-border-2'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        data-testid={`lineup-card-${item.id}`}
        aria-pressed={selected}
        className="flex flex-col p-3.5 text-left"
      >
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold text-ink-1">
              {item.displayTitle}
            </span>
            <span className="block truncate text-xs text-ink-4">
              {item.displayArtist}
            </span>
          </span>
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
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <Badge
            tone={sourcePill.tone}
            size="sm"
            dot={false}
            data-testid={`lineup-source-${item.id}`}
          >
            {sourcePill.label}
          </Badge>
          {handsTotal > 0 && (
            <span
              data-testid={`lineup-hands-${item.id}`}
              className="inline-flex items-center gap-1 rounded-lg bg-info-soft px-2 py-0.5 text-[11px] font-semibold text-info"
            >
              <Hand size={11} /> {handsTotal}
            </span>
          )}
        </div>

        {/* CTA — matches the mobile card; the whole card toggles the cast panel. */}
        <span
          className={`mt-3 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 ${ctaTone}`}
        >
          {fullyCast ? <CheckCircle2 size={17} /> : <Users size={17} />}
          <span className="flex-1 text-sm font-semibold">{ctaLabel}</span>
          <ChevronDown
            size={16}
            className={`transition-transform ${selected ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {selected && children && (
        <div
          className="border-t border-border-1 px-3.5 pb-3.5 pt-1"
          data-testid={`lineup-card-body-${item.id}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}
