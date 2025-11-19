import React from 'react'
import { Song } from '../../models/Song'

interface SongCardProps {
  song: Song
  onClick?: (song: Song) => void
  onEdit?: (song: Song) => void
  onDelete?: (song: Song) => void
  showActions?: boolean
  showContextBadge?: boolean
  hasLinkedVariants?: boolean
  onViewLinked?: (song: Song) => void
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  onClick,
  onEdit,
  onDelete,
  showActions = true,
  showContextBadge = true,
  hasLinkedVariants = false,
  onViewLinked
}) => {
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleCardClick = () => {
    if (onClick) {
      onClick(song)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEdit) {
      onEdit(song)
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete) {
      onDelete(song)
    }
  }

  const handleViewLinked = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onViewLinked) {
      onViewLinked(song)
    }
  }

  const getContextBadge = () => {
    if (!showContextBadge) return null

    if (song.contextType === 'personal') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Personal
        </span>
      )
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Band
      </span>
    )
  }

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300 active:scale-98 touch-manipulation ${onClick ? 'cursor-pointer' : ''}`}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {getContextBadge()}
            {hasLinkedVariants && (
              <button
                onClick={handleViewLinked}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                title="This song has linked variants"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Linked
              </button>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
            {song.title}
          </h3>
          <p className="text-sm text-gray-600 mb-3 truncate">{song.artist}</p>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatDuration(song.duration)}</span>
            </div>

            {song.guitarTuning && (
              <div className="flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span>{song.guitarTuning}</span>
              </div>
            )}
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleEdit}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors touch-manipulation rounded-lg hover:bg-gray-100"
              aria-label="Edit song"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors touch-manipulation rounded-lg hover:bg-red-50"
              aria-label="Delete song"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
