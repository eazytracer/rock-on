import React from 'react'
import { Song } from '../../models/Song'

interface SongCardProps {
  song: Song
  onClick?: (song: Song) => void
  onEdit?: (song: Song) => void
  onDelete?: (song: Song) => void
  showActions?: boolean
  compact?: boolean
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  onClick,
  onEdit,
  onDelete,
  showActions = true,
  compact = false
}) => {
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getDifficultyColor = (difficulty: number): string => {
    const colors = {
      1: 'bg-green-100 text-green-800',
      2: 'bg-yellow-100 text-yellow-800',
      3: 'bg-orange-100 text-orange-800',
      4: 'bg-red-100 text-red-800',
      5: 'bg-purple-100 text-purple-800'
    }
    return colors[difficulty as keyof typeof colors] || colors[3]
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 4) return 'bg-green-100 text-green-800'
    if (confidence >= 3) return 'bg-yellow-100 text-yellow-800'
    if (confidence >= 2) return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }

  const getReadinessText = (confidence: number): string => {
    if (confidence >= 4) return 'Ready'
    if (confidence >= 3) return 'Good'
    if (confidence >= 2) return 'Practice'
    return 'New'
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

  const cardClasses = [
    'bg-white rounded-lg border border-gray-200 shadow-sm',
    'transition-all duration-200',
    'hover:shadow-md hover:border-gray-300',
    'active:scale-98 touch-manipulation',
    onClick ? 'cursor-pointer' : '',
    compact ? 'p-3' : 'p-4'
  ].join(' ')

  if (compact) {
    return (
      <div className={cardClasses} onClick={handleCardClick}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{song.title}</h3>
            <p className="text-sm text-gray-600 truncate">{song.artist}</p>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <span className="text-sm text-gray-500">{song.key}</span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(song.confidenceLevel)}`}>
              {getReadinessText(song.confidenceLevel)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cardClasses} onClick={handleCardClick}>
      <div className="flex flex-col space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
              {song.title}
            </h3>
            <p className="text-sm text-gray-600 mb-2">{song.artist}</p>
            {song.album && (
              <p className="text-xs text-gray-500 italic">{song.album}</p>
            )}
          </div>
          {showActions && (
            <div className="flex items-center space-x-1 ml-2">
              <button
                onClick={handleEdit}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors touch-manipulation"
                aria-label="Edit song"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={handleDelete}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors touch-manipulation"
                aria-label="Delete song"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(song.difficulty)}`}>
            Level {song.difficulty}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(song.confidenceLevel)}`}>
            {getReadinessText(song.confidenceLevel)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="flex flex-col">
            <span className="text-gray-500 text-xs">Key</span>
            <span className="font-medium text-gray-900">{song.key}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500 text-xs">BPM</span>
            <span className="font-medium text-gray-900">{song.bpm}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500 text-xs">Duration</span>
            <span className="font-medium text-gray-900">{formatDuration(song.duration)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500 text-xs">Last Practiced</span>
            <span className="font-medium text-gray-900">
              {song.lastPracticed
                ? new Date(song.lastPracticed).toLocaleDateString()
                : 'Never'
              }
            </span>
          </div>
        </div>

        {song.tags && song.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {song.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
              >
                {tag}
              </span>
            ))}
            {song.tags.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                +{song.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {song.notes && (
          <p className="text-sm text-gray-600 line-clamp-2 italic">
            "{song.notes}"
          </p>
        )}
      </div>
    </div>
  )
}