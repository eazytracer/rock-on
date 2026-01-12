import React from 'react'
import { Edit, Trash2, Music2, Calendar } from 'lucide-react'
import { TouchButton } from '../common/TouchButton'
import { MarkdownRenderer } from './MarkdownRenderer'
import type { SongNoteEntry } from '../../models/SongNoteEntry'

interface NoteEntryCardProps {
  entry: SongNoteEntry
  currentUserId: string
  authorName?: string
  onEdit?: (entry: SongNoteEntry) => void
  onDelete?: (entryId: string) => void
}

/**
 * Display card for a single note entry in the practice log
 * Shows author, date, session context, and markdown content
 * Only shows edit/delete for entry owner
 */
export const NoteEntryCard: React.FC<NoteEntryCardProps> = ({
  entry,
  currentUserId,
  authorName = 'Unknown',
  onEdit,
  onDelete,
}) => {
  const isOwner = entry.userId === currentUserId
  const createdDate = new Date(entry.createdDate)
  const isPersonal = entry.visibility === 'personal'

  return (
    <div
      className="p-4 rounded-lg bg-steel-gray border border-steel-gray/30"
      data-testid={`note-entry-card-${entry.id}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-smoke-white">{authorName}</span>
            {isPersonal && (
              <span className="text-xs px-2 py-0.5 rounded bg-steel-gray border border-smoke-white/20 text-smoke-white/60">
                Private
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-smoke-white/60">
            <span data-testid={`note-entry-date-${entry.id}`}>
              {createdDate.toLocaleDateString()} at{' '}
              {createdDate.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {entry.sessionType && (
              <span
                className="flex items-center gap-1"
                data-testid={`note-entry-session-${entry.id}`}
              >
                {entry.sessionType === 'practice' ? (
                  <Music2 className="w-3 h-3" />
                ) : (
                  <Calendar className="w-3 h-3" />
                )}
                {entry.sessionType === 'practice' ? 'Practice' : 'Show'}
              </span>
            )}
          </div>
        </div>

        {/* Actions - only show for owner */}
        {isOwner && (onEdit || onDelete) && (
          <div className="flex gap-2">
            {onEdit && (
              <TouchButton
                variant="ghost"
                size="sm"
                onClick={() => onEdit(entry)}
                data-testid={`note-entry-edit-${entry.id}`}
                className="!min-h-[36px] !px-2"
              >
                <Edit className="w-4 h-4" />
              </TouchButton>
            )}
            {onDelete && (
              <TouchButton
                variant="ghost"
                size="sm"
                onClick={() => onDelete(entry.id)}
                data-testid={`note-entry-delete-${entry.id}`}
                className="!min-h-[36px] !px-2 !text-amp-red hover:!bg-amp-red/10"
              >
                <Trash2 className="w-4 h-4" />
              </TouchButton>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div data-testid={`note-entry-content-${entry.id}`}>
        <MarkdownRenderer content={entry.content} />
      </div>
    </div>
  )
}
