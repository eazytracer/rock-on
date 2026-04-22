import React from 'react'
import { Music, AlertTriangle, Check, X, Users, Plus } from 'lucide-react'
import type { JamSongMatch } from '../../models/JamSession'

interface JamMatchListProps {
  matches: JamSongMatch[]
  isHost?: boolean
  readOnly?: boolean
  /** IDs already added to the setlist — used to show added state on the button */
  setlistMatchIds?: Set<string>
  onConfirm?: (matchId: string) => void
  onDismiss?: (matchId: string) => void
  onAddToSetlist?: (match: JamSongMatch) => void
}

/**
 * Renders the list of common songs found in a jam session.
 *
 * - Exact matches shown first, fully confirmed
 * - Fuzzy matches shown with a warning and confirm/dismiss buttons (host only)
 * - readOnly mode hides all action buttons (used in public/anon view)
 */
export const JamMatchList: React.FC<JamMatchListProps> = ({
  matches,
  isHost = false,
  readOnly = false,
  setlistMatchIds,
  onConfirm,
  onDismiss,
  onAddToSetlist,
}) => {
  const confirmedMatches = matches.filter(m => m.isConfirmed)
  const fuzzyMatches = matches.filter(m => !m.isConfirmed)

  if (matches.length === 0) {
    return (
      <div
        data-testid="jam-match-list"
        className="text-[#707070] text-sm text-center py-8"
      >
        <Music size={32} className="mx-auto mb-3 opacity-30" />
        <p>No common songs found yet.</p>
        <p className="text-xs mt-1 opacity-60">
          Songs appear here when at least 2 participants share them.
        </p>
      </div>
    )
  }

  return (
    <div data-testid="jam-match-list" className="space-y-2">
      {/* Confirmed matches */}
      {confirmedMatches.map(match => (
        <MatchItem
          key={match.id}
          match={match}
          isHost={isHost}
          readOnly={readOnly}
          inSetlist={setlistMatchIds?.has(match.id) ?? false}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
          onAddToSetlist={onAddToSetlist}
        />
      ))}

      {/* Fuzzy matches section */}
      {fuzzyMatches.length > 0 && !readOnly && (
        <>
          <div className="flex items-center gap-2 mt-4 mb-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-amber-400 text-xs font-medium">
              Possible matches — confirm if these are the same song
            </span>
          </div>
          {fuzzyMatches.map(match => (
            <MatchItem
              key={match.id}
              match={match}
              isHost={isHost}
              readOnly={readOnly}
              inSetlist={false}
              onConfirm={onConfirm}
              onDismiss={onDismiss}
              onAddToSetlist={onAddToSetlist}
            />
          ))}
        </>
      )}

      <p className="text-[#707070] text-xs mt-3">
        {confirmedMatches.length} confirmed song
        {confirmedMatches.length !== 1 ? 's' : ''} in common
        {fuzzyMatches.length > 0 && ` · ${fuzzyMatches.length} possible`}
      </p>
    </div>
  )
}

// ============================================================================
// MatchItem sub-component
// ============================================================================

interface MatchItemProps {
  match: JamSongMatch
  isHost: boolean
  readOnly: boolean
  /** Whether this match has already been added to the setlist */
  inSetlist: boolean
  onConfirm?: (id: string) => void
  onDismiss?: (id: string) => void
  onAddToSetlist?: (match: JamSongMatch) => void
}

const MatchItem: React.FC<MatchItemProps> = ({
  match,
  isHost,
  readOnly,
  inSetlist,
  onConfirm,
  onDismiss,
  onAddToSetlist,
}) => {
  const isFuzzy = !match.isConfirmed

  return (
    <div
      data-testid={`jam-match-item-${match.id}`}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        isFuzzy ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-[#1a1a1a]'
      }`}
    >
      {/* Song icon */}
      <Music
        size={16}
        className={
          isFuzzy
            ? 'text-amber-400 flex-shrink-0'
            : 'text-[#707070] flex-shrink-0'
        }
      />

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">
          {match.displayTitle}
        </p>
        <p className="text-[#707070] text-xs truncate">{match.displayArtist}</p>
      </div>

      {/* Participant count badge */}
      <span className="flex items-center gap-1 text-[#707070] text-xs flex-shrink-0">
        <Users size={11} />
        {match.participantCount}
      </span>

      {/* Fuzzy match warning */}
      {isFuzzy && (
        <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
      )}

      {/* Add to Setlist button — confirmed matches, host only, non-readonly */}
      {!isFuzzy && isHost && !readOnly && onAddToSetlist && (
        <button
          data-testid={`jam-match-add-setlist-${match.id}`}
          onClick={() => onAddToSetlist(match)}
          disabled={inSetlist}
          title={inSetlist ? 'Already in setlist' : 'Add to setlist'}
          aria-label={`Add ${match.displayTitle} to setlist`}
          className={`p-1 rounded-md transition-colors flex-shrink-0 ${
            inSetlist
              ? 'text-[#f17827ff] opacity-60 cursor-default'
              : 'text-[#707070] hover:text-[#f17827ff] hover:bg-[#f17827ff]/10'
          }`}
        >
          <Plus size={14} />
        </button>
      )}

      {/* Confirm/dismiss buttons (host only, non-readonly, fuzzy matches) */}
      {isFuzzy && isHost && !readOnly && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            data-testid={`jam-match-confirm-${match.id}`}
            onClick={() => onConfirm?.(match.id)}
            className="p-1 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            title="Yes, same song"
            aria-label={`Confirm match: ${match.displayTitle}`}
          >
            <Check size={14} />
          </button>
          <button
            data-testid={`jam-match-dismiss-${match.id}`}
            onClick={() => onDismiss?.(match.id)}
            className="p-1 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            title="No, different song"
            aria-label={`Dismiss match: ${match.displayTitle}`}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
