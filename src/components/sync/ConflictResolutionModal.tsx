import React, { useState } from 'react'
import { AlertTriangle, Loader2, Monitor, Cloud } from 'lucide-react'
import { SyncConflict, ConflictResolution } from '../../services/data/syncTypes'

interface ConflictResolutionModalProps {
  conflict: SyncConflict | null
  onResolve: (resolution: ConflictResolution) => Promise<void>
  onDismiss: () => void
}

/**
 * Modal for resolving sync conflicts between local and remote versions
 */
export const ConflictResolutionModal: React.FC<
  ConflictResolutionModalProps
> = ({ conflict, onResolve, onDismiss }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedResolution, setSelectedResolution] =
    useState<ConflictResolution | null>(null)

  if (!conflict) return null

  const handleResolve = async (resolution: ConflictResolution) => {
    setIsLoading(true)
    setSelectedResolution(resolution)
    try {
      await onResolve(resolution)
    } finally {
      setIsLoading(false)
      setSelectedResolution(null)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onDismiss()
    }
  }

  // Get display-friendly table name
  const getTableDisplayName = (table: string): string => {
    const names: Record<string, string> = {
      songs: 'Song',
      setlists: 'Setlist',
      shows: 'Show',
      practice_sessions: 'Practice Session',
    }
    return names[table] || table
  }

  // Get the item name/title for display
  const getItemName = (): string => {
    const local = conflict.localData
    return local?.title || local?.name || conflict.recordId
  }

  // Format a value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(empty)'
    if (typeof value === 'object') {
      if (value instanceof Date) return value.toLocaleString()
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  // Get changed fields between local and remote
  const getChangedFields = (): Array<{
    field: string
    local: unknown
    remote: unknown
  }> => {
    const local = conflict.localData || {}
    const remote = conflict.remoteData || {}
    const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)])
    const changes: Array<{ field: string; local: unknown; remote: unknown }> =
      []

    // Fields to skip (internal/metadata)
    const skipFields = [
      'id',
      'createdDate',
      'createdBy',
      'contextType',
      'contextId',
      'bandId',
    ]

    for (const key of allKeys) {
      if (skipFields.includes(key)) continue
      if (JSON.stringify(local[key]) !== JSON.stringify(remote[key])) {
        changes.push({
          field: key,
          local: local[key],
          remote: remote[key],
        })
      }
    }

    return changes
  }

  const changedFields = getChangedFields()

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      data-testid="conflict-modal-backdrop"
    >
      <div
        className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-2xl shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        data-testid="conflict-modal"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#2a2a2a]">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-2 rounded-full bg-amber-500/10">
              <AlertTriangle size={20} className="text-amber-500" />
            </div>
            <div className="flex-1">
              <h3
                className="text-white font-semibold text-lg"
                data-testid="conflict-modal-title"
              >
                Sync Conflict Detected
              </h3>
              <p className="text-[#a0a0a0] text-sm mt-1">
                This {getTableDisplayName(conflict.table).toLowerCase()} was
                modified on another device while you had unsaved changes.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Item identifier */}
          <div className="mb-4 p-3 bg-[#252525] rounded-lg">
            <span className="text-[#808080] text-sm">
              {getTableDisplayName(conflict.table)}:
            </span>
            <span className="text-white ml-2 font-medium">{getItemName()}</span>
          </div>

          {/* Changed fields comparison */}
          {changedFields.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-[#a0a0a0] text-sm font-medium">
                Changed Fields:
              </h4>
              {changedFields.slice(0, 5).map(({ field, local, remote }) => (
                <div
                  key={field}
                  className="border border-[#2a2a2a] rounded-lg overflow-hidden"
                >
                  <div className="bg-[#252525] px-3 py-2 text-[#a0a0a0] text-sm font-medium capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-[#2a2a2a]">
                    <div className="p-3">
                      <div className="flex items-center gap-2 text-blue-400 text-xs mb-2">
                        <Monitor size={12} />
                        Your Version
                      </div>
                      <div className="text-white text-sm break-words">
                        {formatValue(local)}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex items-center gap-2 text-green-400 text-xs mb-2">
                        <Cloud size={12} />
                        Cloud Version
                      </div>
                      <div className="text-white text-sm break-words">
                        {formatValue(remote)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {changedFields.length > 5 && (
                <p className="text-[#808080] text-sm">
                  ...and {changedFields.length - 5} more field(s)
                </p>
              )}
            </div>
          ) : (
            <p className="text-[#808080] text-sm">
              Unable to determine specific changes.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-[#2a2a2a] bg-[#151515]">
          <p className="text-[#808080] text-sm mb-4">
            Choose which version to keep. The other version will be discarded.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleResolve('local')}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              data-testid="conflict-keep-local"
            >
              {isLoading && selectedResolution === 'local' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Monitor size={16} />
              )}
              Keep My Version
            </button>
            <button
              onClick={() => handleResolve('remote')}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              data-testid="conflict-keep-remote"
            >
              {isLoading && selectedResolution === 'remote' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Cloud size={16} />
              )}
              Keep Cloud Version
            </button>
          </div>
          <button
            onClick={onDismiss}
            disabled={isLoading}
            className="w-full mt-3 px-4 py-2 text-[#a0a0a0] text-sm hover:text-white transition-colors disabled:opacity-50"
            data-testid="conflict-dismiss"
          >
            Decide Later
          </button>
        </div>
      </div>
    </div>
  )
}
