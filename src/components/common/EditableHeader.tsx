import React from 'react'
import { ArrowLeft, Edit, X, Check, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface EditableHeaderProps {
  title: string
  subtitle?: string
  backPath: string
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  isSaving?: boolean
  editLabel?: string
  saveLabel?: string
  cancelLabel?: string
}

export const EditableHeader: React.FC<EditableHeaderProps> = ({
  title,
  subtitle,
  backPath,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isSaving = false,
  editLabel = 'Edit',
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
}) => {
  const navigate = useNavigate()

  const handleBack = () => {
    if (isEditing) {
      // Confirm before leaving in edit mode
      if (window.confirm('Discard unsaved changes?')) {
        navigate(backPath)
      }
    } else {
      navigate(backPath)
    }
  }

  return (
    <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-[#2a2a2a]">
      <div className="px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          {/* Left side: Back button + Title */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <button
              onClick={handleBack}
              className="p-2 text-[#a0a0a0] hover:text-white hover:bg-[#252525] rounded-lg transition-colors flex-shrink-0"
              data-testid="header-back-button"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1
                className="text-lg sm:text-xl font-bold text-white truncate"
                data-testid="header-title"
              >
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs sm:text-sm text-[#707070] truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right side: Action buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {isEditing ? (
              <>
                {/* Mobile: Icon buttons */}
                <button
                  onClick={onCancel}
                  disabled={isSaving}
                  className="sm:hidden p-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white hover:bg-[#1f1f1f] transition-colors disabled:opacity-50"
                  data-testid="header-cancel-button"
                  title={cancelLabel}
                >
                  <X size={18} />
                </button>
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="sm:hidden p-2 rounded-lg bg-[#f17827ff] text-white hover:bg-[#d96a1f] transition-colors disabled:opacity-50"
                  data-testid="header-save-button"
                  title={saveLabel}
                >
                  {isSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Check size={18} />
                  )}
                </button>

                {/* Desktop: Text buttons */}
                <button
                  onClick={onCancel}
                  disabled={isSaving}
                  className="hidden sm:block px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors disabled:opacity-50"
                  data-testid="header-cancel-button"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d96a1f] transition-colors disabled:opacity-50"
                  data-testid="header-save-button"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />}
                  {isSaving ? 'Saving...' : saveLabel}
                </button>
              </>
            ) : (
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#f17827ff] hover:bg-[#d96a1f] text-white text-sm font-medium rounded-lg transition-colors"
                data-testid="header-edit-button"
              >
                <Edit size={16} />
                <span className="hidden sm:inline">{editLabel}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
