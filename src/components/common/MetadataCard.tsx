import React from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'

interface MetadataCardProps {
  title?: string
  isEditing: boolean
  onEditStart: () => void
  onSave: () => void | Promise<void>
  onCancel: () => void
  isSaving?: boolean
  children: React.ReactNode
  columns?: 1 | 2 | 3
  className?: string
}

/**
 * Self-contained metadata card with its own edit state.
 * Shows pencil icon in top-right corner to enter edit mode.
 * When editing, shows Save/Cancel buttons.
 */
export const MetadataCard: React.FC<MetadataCardProps> = ({
  title,
  isEditing,
  onEditStart,
  onSave,
  onCancel,
  isSaving = false,
  children,
  columns = 2,
  className = '',
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  }

  const handleSave = async () => {
    await onSave()
  }

  return (
    <div
      className={`bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6 ${className}`}
      data-testid="metadata-card"
    >
      {/* Header with title and edit controls */}
      <div className="flex items-center justify-between mb-4">
        {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
        {!title && <div />}

        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="p-2 text-[#a0a0a0] hover:text-white hover:bg-[#252525] rounded-lg transition-colors disabled:opacity-50"
              data-testid="metadata-cancel-button"
              title="Cancel"
            >
              <X size={18} />
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#f17827ff] hover:bg-[#d66920] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              data-testid="metadata-save-button"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              <span className="hidden sm:inline">Save</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onEditStart}
            className="p-2 text-[#707070] hover:text-[#f17827ff] hover:bg-[#252525] rounded-lg transition-colors"
            data-testid="metadata-edit-button"
            title="Edit details"
          >
            <Pencil size={18} />
          </button>
        )}
      </div>

      {/* Grid content */}
      <div className={`grid ${gridCols[columns]} gap-4 sm:gap-6`}>
        {children}
      </div>
    </div>
  )
}

// Re-export helpers from MetadataSection for convenience
export { FullWidthField, MetadataDivider } from './MetadataSection'
