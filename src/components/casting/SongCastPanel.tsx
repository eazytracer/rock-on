import { useEffect, useMemo, useState } from 'react'
import { UserPlus, X, History } from 'lucide-react'
import { useCasting } from '../../hooks/useCasting'
import { useBandMembers } from '../../hooks/useBands'
import { CastingAssignmentService } from '../../services/CastingAssignmentService'
import { Avatar } from '../common/Avatar'
import { Eyebrow } from '../common/Eyebrow'
import type { CastingContext, CastingHistoryEntry } from '../../models/Casting'

interface SongCastPanelProps {
  contextType: CastingContext
  contextId: string
  bandId?: string
  /** SetlistItem.id or event_lineup_items.id */
  slotId: string
  songId?: string
  /** Whether the current user may cast (band admin / event host+cohost). */
  canEdit: boolean
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
}: SongCastPanelProps) {
  const { defaultParts, casting, loading, assign, unassign } = useCasting(
    contextType,
    contextId,
    bandId
  )
  const { members } = useBandMembers(bandId ?? '')
  const [pickingRole, setPickingRole] = useState<string | null>(null)
  const [history, setHistory] = useState<CastingHistoryEntry[]>([])

  // This slot's assignments only.
  const slotCasting = useMemo(
    () => casting.filter(c => c.slotId === slotId),
    [casting, slotId]
  )

  useEffect(() => {
    if (bandId && songId) {
      void CastingAssignmentService.getSongHistory(bandId, songId).then(
        setHistory
      )
    }
  }, [bandId, songId])

  const memberName = (userId?: string) => {
    const m = members.find(x => x.membership.userId === userId)
    return m?.user?.name ?? m?.profile?.displayName ?? 'Member'
  }

  const partsCast = defaultParts.filter(p =>
    slotCasting.some(c => c.roleKey === p.key && c.isPrimary)
  ).length

  const doAssign = async (roleKey: string, userId: string) => {
    setPickingRole(null)
    await assign({
      contextType,
      contextId,
      slotId,
      bandId,
      songId,
      roleKey,
      memberId: userId,
      memberName: memberName(userId),
      isPrimary: true,
    })
  }

  if (loading) {
    return <div className="py-2 text-xs text-ink-5">Loading casting…</div>
  }

  return (
    <div
      className="mt-2 rounded-lg bg-bg-2 border border-border-1 p-3"
      data-testid={`cast-panel-${slotId}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <Eyebrow>Casting</Eyebrow>
        <span
          className="font-mono text-[10px] text-ink-4"
          data-testid="cast-progress"
        >
          {partsCast}/{defaultParts.length} parts cast
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {defaultParts.map(part => {
          const assigned = slotCasting.filter(c => c.roleKey === part.key)
          return (
            <div
              key={part.key}
              className="flex items-center gap-2"
              data-testid={`cast-role-${part.key}`}
            >
              <span className="w-24 flex-shrink-0 text-xs text-ink-3">
                {part.label}
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-1.5">
                {assigned.map(c => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-bg-3 py-0.5 pl-0.5 pr-2"
                    data-testid={`cast-assigned-${c.id}`}
                  >
                    <Avatar
                      label={c.memberName ?? memberName(c.memberId)}
                      size="xs"
                    />
                    <span className="text-xs text-ink-1">
                      {c.memberName ?? memberName(c.memberId)}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => void unassign(c.id)}
                        aria-label="Remove"
                        data-testid={`cast-remove-${c.id}`}
                        className="text-ink-5 hover:text-danger"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
                {assigned.length === 0 && (
                  <span className="text-xs text-ink-5">Open</span>
                )}
                {canEdit && (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setPickingRole(
                          pickingRole === part.key ? null : part.key
                        )
                      }
                      data-testid={`cast-assign-${part.key}`}
                      aria-label={`Assign ${part.label}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border-2 px-2 py-0.5 text-[11px] text-ink-3 hover:text-accent hover:border-accent"
                    >
                      <UserPlus size={12} /> Assign
                    </button>
                    {pickingRole === part.key && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setPickingRole(null)}
                        />
                        <div
                          className="absolute left-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border-1 bg-bg-3 shadow-xl"
                          data-testid={`cast-picker-${part.key}`}
                        >
                          {members.map(m => (
                            <button
                              key={m.membership.userId}
                              onClick={() =>
                                void doAssign(part.key, m.membership.userId)
                              }
                              data-testid={`cast-pick-${part.key}-${m.membership.userId}`}
                              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-ink-2 hover:bg-bg-4 hover:text-ink-1"
                            >
                              <Avatar
                                label={m.user?.name ?? 'Member'}
                                size="xs"
                              />
                              {m.user?.name ??
                                m.profile?.displayName ??
                                'Member'}
                            </button>
                          ))}
                          {members.length === 0 && (
                            <div className="px-2.5 py-2 text-xs text-ink-5">
                              No band members
                            </div>
                          )}
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
                {h.memberName ?? memberName(h.memberId)} ·{' '}
                {h.roleKey.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
