import { useEffect, useMemo, useState } from 'react'
import { UserPlus, X, History, Check, Hand } from 'lucide-react'
import { useCasting } from '../../hooks/useCasting'
import { useBandMembers } from '../../hooks/useBands'
import { useEventParticipants } from '../../hooks/useEvents'
import { CastingAssignmentService } from '../../services/CastingAssignmentService'
import { Avatar } from '../common/Avatar'
import { Eyebrow } from '../common/Eyebrow'
import { INSTRUMENT_META, FALLBACK_INSTRUMENT } from './instrumentMeta'
import type { CastingContext, CastingHistoryEntry } from '../../models/Casting'
import type { RaisedHand } from '../../models/Event'

// Concise part labels (band roles can be long, e.g. "Lead Vocals" → "Vox"),
// matching the grid header.
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
const shortPartLabel = (key: string, fallback: string) =>
  SHORT_PART_LABEL[key] ?? fallback

interface SongCastPanelProps {
  contextType: CastingContext
  contextId: string
  bandId?: string
  /** SetlistItem.id or event_lineup_items.id */
  slotId: string
  songId?: string
  /** Whether the current user may cast (band admin / event host+cohost). */
  canEdit: boolean
  /**
   * Raise-a-hand (event only, fork #5). When provided, guests get a per-part
   * "Raise hand" affordance and the host can accept (→ casts them) / decline.
   * Omitted for setlist casting — that flow is unchanged.
   */
  hands?: RaisedHand[]
  currentUserId?: string
  /** A participant may raise a hand (event allows suggestions + not the host). */
  canRaiseHand?: boolean
  onRaiseHand?: (roleKey: string) => void | Promise<void>
  onWithdrawHand?: (handId: string) => void | Promise<void>
  /** Resolve a hand: accept (already cast by this panel) or decline. */
  onResolveHand?: (handId: string, accept: boolean) => void | Promise<void>
  /** Drop the panel's own box chrome so it flows inside a host container. */
  embedded?: boolean
}

/**
 * The v1 cast surface (List view): per-song role slots. Shows the default lineup,
 * who's cast on each part (or "open"), a director assign/unassign flow, an "N/M parts
 * cast" summary, and — using the band-wide history — who's played this song before.
 */
export function SongCastPanel({
  contextType,
  contextId,
  bandId,
  slotId,
  songId,
  canEdit,
  hands,
  currentUserId,
  canRaiseHand,
  onRaiseHand,
  onWithdrawHand,
  onResolveHand,
  embedded = false,
}: SongCastPanelProps) {
  const { defaultParts, casting, loading, assign, unassign } = useCasting(
    contextType,
    contextId,
    bandId
  )
  // Cast from the right pool: EVENT → participants (guests, not just band members);
  // SETLIST → band members. The casting RLS already authorizes event participants.
  const isEvent = contextType === 'event'
  const { participants } = useEventParticipants(isEvent ? contextId : undefined)
  const { members } = useBandMembers(isEvent ? '' : (bandId ?? ''))
  const [pickingRole, setPickingRole] = useState<string | null>(null)
  const [pickingBackup, setPickingBackup] = useState(false)
  const [freeText, setFreeText] = useState('')
  const [history, setHistory] = useState<CastingHistoryEntry[]>([])

  const assignablePeople = useMemo(
    () =>
      isEvent
        ? participants.map(p => ({ id: p.userId, name: p.name }))
        : members.map(m => ({
            id: m.membership.userId,
            name: m.user?.name ?? m.profile?.displayName ?? 'Member',
          })),
    [isEvent, participants, members]
  )
  // Put the logged-in user first in the picker and call them out — casting
  // yourself is common, so it shouldn't be buried under everyone else.
  const orderedPeople = useMemo(
    () =>
      currentUserId
        ? [
            ...assignablePeople.filter(p => p.id === currentUserId),
            ...assignablePeople.filter(p => p.id !== currentUserId),
          ]
        : assignablePeople,
    [assignablePeople, currentUserId]
  )

  // This slot's assignments only.
  const slotCasting = useMemo(
    () => casting.filter(c => c.slotId === slotId),
    [casting, slotId]
  )

  // This slot's raised hands (event only; empty for setlists).
  const slotHands = useMemo(
    () => (hands ?? []).filter(h => h.lineupItemId === slotId),
    [hands, slotId]
  )

  useEffect(() => {
    if (bandId && songId) {
      void CastingAssignmentService.getSongHistory(bandId, songId).then(
        setHistory
      )
    }
  }, [bandId, songId])

  const personName = (userId?: string) =>
    assignablePeople.find(p => p.id === userId)?.name ?? 'Member'

  const doAssign = async (
    roleKey: string,
    person: { memberId?: string; memberName: string },
    isPrimary = true
  ) => {
    setPickingRole(null)
    setPickingBackup(false)
    setFreeText('')
    // Backups get an ordered priority among themselves (starter stays priority-less).
    const backupCount = slotCasting.filter(
      c => c.roleKey === roleKey && !c.isPrimary
    ).length
    await assign({
      contextType,
      contextId,
      slotId,
      bandId,
      songId,
      roleKey,
      memberId: person.memberId,
      memberName: person.memberName,
      isPrimary,
      priority: isPrimary ? undefined : backupCount + 1,
    })
  }

  // Host accepts a raised hand → cast that person on the part, then resolve it.
  const acceptHand = async (h: RaisedHand) => {
    await doAssign(h.roleKey, { memberId: h.userId, memberName: h.userName })
    await onResolveHand?.(h.id, true)
  }

  if (loading) {
    return <div className="py-2 text-xs text-ink-5">Loading casting…</div>
  }

  return (
    <div
      className={
        embedded ? '' : 'mt-2 rounded-lg bg-bg-2 border border-border-1 p-3'
      }
      data-testid={`cast-panel-${slotId}`}
    >
      <Eyebrow className="mb-3">Casting</Eyebrow>

      <div className="flex flex-col gap-2.5">
        {defaultParts.map(part => {
          const assigned = slotCasting.filter(c => c.roleKey === part.key)
          const primaries = assigned.filter(c => c.isPrimary)
          const instrument = INSTRUMENT_META[part.key] ?? FALLBACK_INSTRUMENT
          const InstrumentIcon = instrument.Icon
          const raisedForPart = slotHands.filter(
            h => h.roleKey === part.key && h.status === 'raised'
          )
          const myRaised = raisedForPart.find(h => h.userId === currentUserId)
          const iAmCastHere = assigned.some(c => c.memberId === currentUserId)
          return (
            <div
              key={part.key}
              className="flex items-center gap-3 py-1.5"
              data-testid={`cast-role-${part.key}`}
            >
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                style={{
                  color: instrument.color,
                  backgroundColor: `color-mix(in srgb, ${instrument.color} 16%, transparent)`,
                }}
                aria-hidden="true"
              >
                <InstrumentIcon size={16} />
              </span>
              <span className="w-24 flex-shrink-0 text-sm text-ink-3">
                {shortPartLabel(part.key, part.label)}
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {primaries.map(c => {
                  const isMe = !!currentUserId && c.memberId === currentUserId
                  return (
                    <span
                      key={c.id}
                      className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 ${
                        isMe ? 'bg-info-soft ring-1 ring-info/50' : 'bg-bg-3'
                      }`}
                      data-testid={`cast-assigned-${c.id}`}
                    >
                      <Avatar
                        label={c.memberName ?? personName(c.memberId)}
                        size="sm"
                      />
                      <span
                        className={`text-sm ${isMe ? 'font-medium text-info' : 'text-ink-1'}`}
                      >
                        {c.memberName ?? personName(c.memberId)}
                      </span>
                      {isMe && (
                        <span className="rounded-full bg-info px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          You
                        </span>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => void unassign(c.id)}
                          aria-label="Remove"
                          data-testid={`cast-remove-${c.id}`}
                          className="-mr-1 rounded p-1.5 text-ink-5 hover:text-danger [@media(pointer:coarse)]:p-2"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </span>
                  )
                })}
                {primaries.length === 0 && raisedForPart.length === 0 && (
                  <span className="text-sm text-ink-5">Open</span>
                )}
                {/* Raise-a-hand (event only, fork #5) */}
                {canEdit &&
                  raisedForPart.map(h => (
                    <span
                      key={h.id}
                      data-testid={`hand-${h.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-info bg-info-soft py-1 pl-1 pr-1.5"
                    >
                      <Avatar label={h.userName} size="sm" />
                      <span className="text-sm font-medium text-info">
                        {h.userName}
                      </span>
                      <Hand size={13} className="text-info" />
                      <button
                        onClick={() => void acceptHand(h)}
                        data-testid={`hand-accept-${h.id}`}
                        aria-label={`Accept ${h.userName}`}
                        className="rounded p-1.5 text-info hover:text-success [@media(pointer:coarse)]:p-2"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => void onResolveHand?.(h.id, false)}
                        data-testid={`hand-decline-${h.id}`}
                        aria-label={`Decline ${h.userName}`}
                        className="rounded p-1.5 text-ink-5 hover:text-danger [@media(pointer:coarse)]:p-2"
                      >
                        <X size={16} />
                      </button>
                    </span>
                  ))}
                {!canEdit && myRaised && (
                  <span
                    data-testid={`hand-mine-${part.key}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-3 py-1.5 text-sm font-medium text-info"
                  >
                    <Hand size={14} /> You — hand up
                    <button
                      onClick={() => void onWithdrawHand?.(myRaised.id)}
                      data-testid={`hand-withdraw-${part.key}`}
                      aria-label="Withdraw hand"
                      className="-mr-1 rounded p-1.5 text-ink-5 hover:text-danger [@media(pointer:coarse)]:p-2"
                    >
                      <X size={15} />
                    </button>
                  </span>
                )}
                {!canEdit && canRaiseHand && !myRaised && !iAmCastHere && (
                  <button
                    onClick={() => void onRaiseHand?.(part.key)}
                    data-testid={`hand-raise-${part.key}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-info bg-info-soft px-3 py-2 text-sm font-medium text-info hover:brightness-110"
                  >
                    <Hand size={15} /> Raise hand
                  </button>
                )}
                {canEdit && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setPickingBackup(false)
                        setPickingRole(
                          pickingRole === part.key ? null : part.key
                        )
                      }}
                      data-testid={`cast-assign-${part.key}`}
                      aria-label={`Assign ${part.label}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border-2 px-3 py-2 text-sm text-ink-3 hover:text-accent hover:border-accent"
                    >
                      <UserPlus size={15} /> Assign
                    </button>
                    {pickingRole === part.key && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => {
                            setPickingRole(null)
                            setPickingBackup(false)
                          }}
                        />
                        <div
                          className="absolute right-0 z-20 mt-1 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border-1 bg-bg-3 shadow-xl"
                          data-testid={`cast-picker-${part.key}`}
                        >
                          <div className="max-h-52 overflow-y-auto custom-scrollbar-thin">
                            {orderedPeople.map(person => (
                              <button
                                key={person.id}
                                onClick={() =>
                                  void doAssign(
                                    part.key,
                                    {
                                      memberId: person.id,
                                      memberName: person.name,
                                    },
                                    !pickingBackup
                                  )
                                }
                                data-testid={`cast-pick-${part.key}-${person.id}`}
                                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink-2 hover:bg-bg-4 hover:text-ink-1 ${
                                  person.id === currentUserId
                                    ? 'bg-info-soft'
                                    : ''
                                }`}
                              >
                                <Avatar label={person.name} size="sm" />
                                {person.name}
                                {person.id === currentUserId && (
                                  <span className="ml-auto flex-shrink-0 rounded-full bg-info px-2 py-0.5 text-[10px] font-semibold text-white">
                                    You
                                  </span>
                                )}
                              </button>
                            ))}
                            {assignablePeople.length === 0 && (
                              <div className="px-2.5 py-2 text-xs text-ink-5">
                                {isEvent
                                  ? 'No participants yet'
                                  : 'No band members'}
                              </div>
                            )}
                          </div>
                          {/* Free-text: cast someone who can't/won't join the app. */}
                          <form
                            onSubmit={e => {
                              e.preventDefault()
                              const name = freeText.trim()
                              if (name)
                                void doAssign(
                                  part.key,
                                  { memberName: name },
                                  !pickingBackup
                                )
                            }}
                            className="flex items-center gap-1 border-t border-border-1 p-1.5"
                          >
                            <input
                              value={freeText}
                              onChange={e => setFreeText(e.target.value)}
                              placeholder="Or type a name…"
                              data-testid={`cast-freetext-${part.key}`}
                              className="min-w-0 flex-1 rounded bg-bg-2 px-2 py-1 text-xs text-ink-1 placeholder:text-ink-5 focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={!freeText.trim()}
                              aria-label="Add typed name"
                              data-testid={`cast-freetext-add-${part.key}`}
                              className="flex-shrink-0 rounded p-1 text-ink-3 hover:text-accent disabled:opacity-40"
                            >
                              <Check size={14} />
                            </button>
                          </form>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {history.length > 0 && (
        <div className="mt-3 border-t border-border-1 pt-2">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] text-ink-4">
            <History size={11} /> Previously cast
          </div>
          <div className="flex flex-col gap-0.5" data-testid="cast-history">
            {history.slice(0, 5).map(h => (
              <span key={h.id} className="text-[11px] text-ink-4">
                {h.memberName ?? personName(h.memberId)} ·{' '}
                {h.roleKey.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
