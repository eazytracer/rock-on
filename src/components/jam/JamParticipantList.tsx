import React from 'react'
import { Crown, Circle } from 'lucide-react'
import type { JamParticipant } from '../../models/JamSession'

interface JamParticipantListProps {
  participants: JamParticipant[]
  hostUserId: string
}

/**
 * Displays the list of active participants in a jam session.
 * Shows the host badge on the session host.
 */
export const JamParticipantList: React.FC<JamParticipantListProps> = ({
  participants,
  hostUserId,
}) => {
  const activeParticipants = participants.filter(p => p.status === 'active')

  if (activeParticipants.length === 0) {
    return (
      <div
        data-testid="jam-participant-list"
        className="text-[#707070] text-sm text-center py-4"
      >
        No participants yet
      </div>
    )
  }

  return (
    <div data-testid="jam-participant-list" className="space-y-2">
      {activeParticipants.map(participant => {
        const isHost = participant.userId === hostUserId
        const displayName =
          participant.displayName || `User ${participant.userId.slice(0, 6)}`

        return (
          <div
            key={participant.id}
            data-testid={`jam-participant-${participant.id}`}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1a1a1a]"
          >
            {/* Status indicator */}
            <Circle
              size={8}
              className="text-green-500 fill-green-500 flex-shrink-0"
            />

            {/* Display name */}
            <span className="text-white text-sm flex-1">{displayName}</span>

            {/* Host badge */}
            {isHost && (
              <span
                data-testid={`jam-participant-host-badge`}
                className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full font-medium"
              >
                <Crown size={10} />
                Host
              </span>
            )}
          </div>
        )
      })}

      <p className="text-[#707070] text-xs mt-2">
        {activeParticipants.length} participant
        {activeParticipants.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
