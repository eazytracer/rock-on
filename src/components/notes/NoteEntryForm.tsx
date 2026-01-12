import React, { useState } from 'react'
import { Music2, Calendar, Eye, EyeOff } from 'lucide-react'
import { TouchButton } from '../common/TouchButton'
import { MarkdownEditor } from './MarkdownEditor'

interface SessionContext {
  type: 'practice' | 'show'
  id: string
  name?: string
}

interface NoteEntryFormProps {
  onSubmit: (content: string, visibility: 'personal' | 'band') => void
  onCancel: () => void
  sessionContext?: SessionContext
  initialContent?: string
  initialVisibility?: 'personal' | 'band'
}

/**
 * Form for creating or editing a note entry
 * Includes markdown editor, visibility toggle, and session context display
 */
export const NoteEntryForm: React.FC<NoteEntryFormProps> = ({
  onSubmit,
  onCancel,
  sessionContext,
  initialContent = '',
  initialVisibility = 'band',
}) => {
  const [content, setContent] = useState(initialContent)
  const [visibility, setVisibility] = useState<'personal' | 'band'>(
    initialVisibility
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim()) {
      onSubmit(content, visibility)
    }
  }

  const isValid = content.trim().length > 0

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-4 rounded-lg bg-steel-gray border border-steel-gray/30"
      data-testid="note-entry-form"
    >
      {/* Session Context Display */}
      {sessionContext && (
        <div
          className="flex items-center gap-2 p-3 rounded bg-stage-black/50 border border-steel-gray/30"
          data-testid="note-entry-form-session-context"
        >
          {sessionContext.type === 'practice' ? (
            <Music2 className="w-4 h-4 text-energy-orange" />
          ) : (
            <Calendar className="w-4 h-4 text-energy-orange" />
          )}
          <span className="text-sm text-smoke-white">
            Adding note to{' '}
            <span className="font-semibold">
              {sessionContext.type === 'practice' ? 'Practice' : 'Show'}
            </span>
            {sessionContext.name && (
              <span className="text-smoke-white/60">
                {' '}
                - {sessionContext.name}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Markdown Editor */}
      <MarkdownEditor
        value={content}
        onChange={setContent}
        placeholder="Add your practice notes here... You can use Markdown for formatting."
        minHeight="min-h-[150px]"
      />

      {/* Visibility Toggle */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-smoke-white/80">Visibility:</label>
        <div className="flex gap-2">
          <TouchButton
            type="button"
            variant={visibility === 'band' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setVisibility('band')}
            data-testid="note-entry-form-visibility-band"
          >
            <Eye className="w-4 h-4 mr-2" />
            Band
          </TouchButton>
          <TouchButton
            type="button"
            variant={visibility === 'personal' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setVisibility('personal')}
            data-testid="note-entry-form-visibility-personal"
          >
            <EyeOff className="w-4 h-4 mr-2" />
            Personal
          </TouchButton>
        </div>
      </div>

      <div className="text-xs text-smoke-white/60">
        {visibility === 'band'
          ? 'This note will be visible to all band members'
          : 'This note will only be visible to you'}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <TouchButton
          type="button"
          variant="ghost"
          size="md"
          onClick={onCancel}
          data-testid="note-entry-form-cancel"
        >
          Cancel
        </TouchButton>
        <TouchButton
          type="submit"
          variant="primary"
          size="md"
          disabled={!isValid}
          data-testid="note-entry-form-submit"
        >
          Add Note
        </TouchButton>
      </div>
    </form>
  )
}
