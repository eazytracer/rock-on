import { Users, Hand } from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { Badge } from '../common/Badge'
import type { BadgeTone } from '../../utils/tokens'
import { INSTRUMENT_META, FALLBACK_INSTRUMENT } from './instrumentMeta'
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
}

/**
 * One song in the event Lineup card grid (D2). Shows the song, its provenance
 * pill, a scannable per-part status strip (cast avatar / hand-up / open), and a
 * footer summarising open parts. Selecting the card opens the shared cast panel;
 * the actual casting still happens in SongCastPanel, which this only summarises.
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
}: LineupCardProps) {
  const slotCasting = casting.filter(c => c.slotId === item.id)
  const parts = defaultParts.map(part => {
    const primary = slotCasting.find(c => c.roleKey === part.key && c.isPrimary)
    const handsUp = hands.filter(
      h =>
        h.lineupItemId === item.id &&
        h.roleKey === part.key &&
        h.status === 'raised'
    ).length
    return { part, primary, handsUp }
  })

  const castCount = parts.filter(p => p.primary).length
  const openCount = defaultParts.length - castCount
  const handsTotal = parts.reduce((n, p) => n + p.handsUp, 0)
  const fullyCast = openCount === 0 && defaultParts.length > 0

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`lineup-card-${item.id}`}
      aria-pressed={selected}
      className={`flex flex-col rounded-2xl bg-bg-1 border p-3 text-left transition-colors ${
        selected ? 'border-accent' : 'border-border-1 hover:border-border-2'
      }`}
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
        <Badge
          tone={sourcePill.tone}
          size="sm"
          dot={false}
          data-testid={`lineup-source-${item.id}`}
          className="flex-shrink-0"
        >
          {sourcePill.label}
        </Badge>
      </div>

      {/* Per-part status strip */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {parts.map(({ part, primary, handsUp }) => {
          const meta = INSTRUMENT_META[part.key] ?? FALLBACK_INSTRUMENT
          const Icon = meta.Icon
          const tone = primary ? 'cast' : handsUp > 0 ? 'hand' : 'open'
          return (
            <span
              key={part.key}
              data-testid={`card-part-${item.id}-${part.key}`}
              data-state={tone}
              title={
                primary
                  ? `${part.label} · ${primary.memberName ?? 'cast'}`
                  : handsUp > 0
                    ? `${part.label} · ${handsUp} hand${handsUp === 1 ? '' : 's'} up`
                    : `${part.label} · open`
              }
              className={`inline-flex items-center gap-1 rounded-lg py-1 pl-1.5 pr-2 text-xs ${
                tone === 'hand'
                  ? 'bg-info-soft text-info'
                  : tone === 'open'
                    ? 'bg-bg-2 text-ink-5'
                    : 'bg-bg-2 text-ink-2'
              }`}
            >
              <span
                className="flex h-4 w-4 flex-shrink-0 items-center justify-center"
                style={{ color: tone === 'hand' ? undefined : meta.color }}
              >
                <Icon size={12} />
              </span>
              {primary ? (
                <Avatar
                  label={primary.memberName ?? 'Cast'}
                  size="xs"
                  className="!h-4 !w-4 !text-[8px]"
                />
              ) : handsUp > 0 ? (
                <span className="inline-flex items-center gap-0.5 font-medium">
                  <Hand size={11} /> {handsUp}
                </span>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-bg-4" />
              )}
            </span>
          )
        })}
      </div>

      {/* Footer summary */}
      <div className="mt-2.5 flex items-center gap-2 text-xs">
        {fullyCast ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-success">
            <Users size={13} /> Fully cast
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 font-medium ${
              isManager ? 'text-accent' : 'text-ink-3'
            }`}
          >
            <Users size={13} />
            {isManager ? 'Cast ' : ''}
            {openCount} open part{openCount === 1 ? '' : 's'}
          </span>
        )}
        {handsTotal > 0 && (
          <span className="inline-flex items-center gap-1 text-info">
            <Hand size={12} /> {handsTotal} up
          </span>
        )}
      </div>
    </button>
  )
}
