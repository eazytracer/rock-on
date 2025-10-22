/**
 * SongLinkingSuggestions Component
 *
 * Displays smart suggestions for linking song variants across contexts
 * Shows when songs in different contexts (personal/band) might be related
 */

import React, { useState } from 'react'
import { Song } from '../../models/Song'
import { LinkingSuggestion } from '../../services/SongLinkingService'

interface SongLinkingSuggestionsProps {
  suggestions: LinkingSuggestion[]
  onLink: (songId: string, targetSongId: string) => Promise<void>
  onDismiss: (songId: string, targetSongId: string) => void
  className?: string
}

export const SongLinkingSuggestions: React.FC<SongLinkingSuggestionsProps> = ({
  suggestions,
  onLink,
  onDismiss,
  className = ''
}) => {
  const [linkingInProgress, setLinkingInProgress] = useState<Set<string>>(new Set())

  if (suggestions.length === 0) {
    return null
  }

  const handleLink = async (suggestion: LinkingSuggestion) => {
    const key = `${suggestion.song.id}-${suggestion.targetSong.id}`
    setLinkingInProgress(prev => new Set(prev).add(key))

    try {
      await onLink(suggestion.song.id!, suggestion.targetSong.id!)
    } finally {
      setLinkingInProgress(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const getConfidenceColor = (confidence: LinkingSuggestion['confidence']) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-50 border-green-200'
      case 'medium':
        return 'bg-yellow-50 border-yellow-200'
      case 'low':
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getConfidenceBadgeColor = (confidence: LinkingSuggestion['confidence']) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getContextLabel = (song: Song) => {
    return song.contextType === 'personal' ? 'Personal' : 'Band'
  }

  const getContextIcon = (song: Song) => {
    if (song.contextType === 'personal') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center space-x-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <h3 className="text-sm font-medium text-gray-900">
          Suggested Song Links ({suggestions.length})
        </h3>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const key = `${suggestion.song.id}-${suggestion.targetSong.id}`
          const isLinking = linkingInProgress.has(key)

          return (
            <div
              key={key}
              className={`p-3 rounded-lg border ${getConfidenceColor(suggestion.confidence)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Confidence Badge */}
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getConfidenceBadgeColor(suggestion.confidence)}`}>
                      {suggestion.confidence.charAt(0).toUpperCase() + suggestion.confidence.slice(1)} Match
                    </span>
                  </div>

                  {/* Song comparison */}
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2 text-sm">
                      {getContextIcon(suggestion.song)}
                      <span className="font-medium text-gray-900">{suggestion.song.title}</span>
                      <span className="text-gray-500">by {suggestion.song.artist}</span>
                      <span className="text-xs text-gray-400">({getContextLabel(suggestion.song)})</span>
                    </div>

                    <div className="flex items-center space-x-2 pl-6">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="text-xs text-gray-500">{suggestion.reason}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-sm">
                      {getContextIcon(suggestion.targetSong)}
                      <span className="font-medium text-gray-900">{suggestion.targetSong.title}</span>
                      <span className="text-gray-500">by {suggestion.targetSong.artist}</span>
                      <span className="text-xs text-gray-400">({getContextLabel(suggestion.targetSong)})</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleLink(suggestion)}
                    disabled={isLinking}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLinking ? (
                      <>
                        <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Linking...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Link
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => onDismiss(suggestion.song.id!, suggestion.targetSong.id!)}
                    disabled={isLinking}
                    className="inline-flex items-center px-2 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
