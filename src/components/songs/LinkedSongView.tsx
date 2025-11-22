/**
 * LinkedSongView Component
 *
 * Displays linked song variants side by side for comparison
 * Shows differences between personal and band versions, different arrangements, etc.
 */

import React from 'react'
import { Song } from '../../models/Song'
import { SongGroup } from '../../models/SongGroup'

interface LinkedSong extends Song {
  relationship: string
  notes?: string
}

interface LinkedSongViewProps {
  songGroup: SongGroup
  linkedSongs: LinkedSong[]
  currentSongId?: string
  onSelectSong?: (songId: string) => void
  onUnlink?: (songId: string) => void
  onContributeToBand?: (songId: string) => void
  onCopyToPersonal?: (songId: string) => void
  className?: string
}

export const LinkedSongView: React.FC<LinkedSongViewProps> = ({
  songGroup,
  linkedSongs,
  currentSongId,
  onSelectSong,
  onUnlink,
  onContributeToBand,
  onCopyToPersonal,
  className = '',
}) => {
  const getContextBadge = (song: Song) => {
    if (song.contextType === 'personal') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          <svg
            className="w-3 h-3 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Personal
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
        <svg
          className="w-3 h-3 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        Band
      </span>
    )
  }

  const getRelationshipBadge = (relationship: string) => {
    const colors: Record<string, string> = {
      original: 'bg-green-100 text-green-800',
      variant: 'bg-gray-100 text-gray-800',
      arrangement: 'bg-yellow-100 text-yellow-800',
      cover: 'bg-orange-100 text-orange-800',
    }

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[relationship] || colors.variant}`}
      >
        {relationship.charAt(0).toUpperCase() + relationship.slice(1)}
      </span>
    )
  }

  if (linkedSongs.length === 0) {
    return null
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <h3 className="text-sm font-medium text-gray-900">
            Linked Variants: {songGroup.name}
          </h3>
          <span className="text-xs text-gray-500">
            ({linkedSongs.length} versions)
          </span>
        </div>
        {songGroup.description && (
          <p className="mt-1 text-xs text-gray-500">{songGroup.description}</p>
        )}
      </div>

      {/* Linked Songs Grid */}
      <div className="divide-y divide-gray-200">
        {linkedSongs.map(song => {
          const isCurrentSong = song.id === currentSongId
          const canContribute =
            song.contextType === 'personal' && onContributeToBand
          const canCopy = song.contextType === 'band' && onCopyToPersonal

          return (
            <div
              key={song.id}
              className={`p-4 hover:bg-gray-50 transition-colors ${
                isCurrentSong ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                {/* Song Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    {getContextBadge(song)}
                    {getRelationshipBadge(song.relationship)}
                    {isCurrentSong && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-200 text-blue-900">
                        Current
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {song.title}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    by {song.artist}
                  </p>

                  {song.notes && (
                    <p className="text-xs text-gray-600 mt-2 italic">
                      {song.notes}
                    </p>
                  )}

                  {/* Song Details */}
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="text-gray-500">Key:</span>{' '}
                      <span className="text-gray-900 font-medium">
                        {song.key}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">BPM:</span>{' '}
                      <span className="text-gray-900 font-medium">
                        {song.bpm}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Difficulty:</span>{' '}
                      <span className="text-gray-900 font-medium">
                        {song.difficulty}/5
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Confidence:</span>{' '}
                      <span className="text-gray-900 font-medium">
                        {song.confidenceLevel}/5
                      </span>
                    </div>
                  </div>

                  {song.guitarTuning && (
                    <div className="mt-2 text-xs">
                      <span className="text-gray-500">Tuning:</span>{' '}
                      <span className="text-gray-900 font-mono">
                        {song.guitarTuning}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col space-y-2 ml-4">
                  {!isCurrentSong && onSelectSong && (
                    <button
                      onClick={() => onSelectSong(song.id!)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      View
                    </button>
                  )}

                  {canContribute && (
                    <button
                      onClick={() => onContributeToBand(song.id!)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                      title="Add this song to band catalog"
                    >
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      To Band
                    </button>
                  )}

                  {canCopy && (
                    <button
                      onClick={() => onCopyToPersonal(song.id!)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      title="Copy this song to personal catalog"
                    >
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      To Personal
                    </button>
                  )}

                  {onUnlink && (
                    <button
                      onClick={() => onUnlink(song.id!)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      title="Unlink this song from the group"
                    >
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Unlink
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
