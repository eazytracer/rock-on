/**
 * SongContextTabs Component
 *
 * Provides tab navigation to switch between Personal and Band song contexts
 */

import React from 'react'

export type SongContext = 'personal' | 'band'

interface BandOption {
  id: string
  name: string
}

interface SongContextTabsProps {
  activeContext: SongContext
  onContextChange: (context: SongContext) => void
  activeBandId?: string
  onBandChange?: (bandId: string) => void
  availableBands?: BandOption[]
  personalSongCount?: number
  bandSongCount?: number
  className?: string
}

export const SongContextTabs: React.FC<SongContextTabsProps> = ({
  activeContext,
  onContextChange,
  activeBandId,
  onBandChange,
  availableBands = [],
  personalSongCount = 0,
  bandSongCount = 0,
  className = ''
}) => {
  // Get the active band name
  const activeBandName = availableBands.find(band => band.id === activeBandId)?.name || 'Band'

  return (
    <div className={`border-b border-gray-200 ${className}`}>
      <nav className="flex space-x-4" aria-label="Song contexts">
        {/* Personal Tab */}
        <button
          onClick={() => onContextChange('personal')}
          className={`
            py-3 px-4 border-b-2 font-medium text-sm transition-colors
            ${
              activeContext === 'personal'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }
          `}
          aria-current={activeContext === 'personal' ? 'page' : undefined}
        >
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4"
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
            <span>Personal</span>
            {personalSongCount > 0 && (
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-200 text-gray-700">
                {personalSongCount}
              </span>
            )}
          </div>
        </button>

        {/* Band Tab */}
        <button
          onClick={() => onContextChange('band')}
          className={`
            py-3 px-4 border-b-2 font-medium text-sm transition-colors
            ${
              activeContext === 'band'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }
          `}
          aria-current={activeContext === 'band' ? 'page' : undefined}
        >
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4"
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
            <span>{activeBandName}</span>
            {bandSongCount > 0 && (
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-200 text-gray-700">
                {bandSongCount}
              </span>
            )}
          </div>
        </button>
      </nav>

      {/* Band Selector (shown when band context is active and multiple bands available) */}
      {activeContext === 'band' && availableBands.length > 1 && onBandChange && (
        <div className="py-3 px-4 bg-gray-50 border-t border-gray-200">
          <label htmlFor="band-selector" className="block text-sm font-medium text-gray-700 mb-2">
            Select Band:
          </label>
          <select
            id="band-selector"
            value={activeBandId || ''}
            onChange={(e) => onBandChange(e.target.value)}
            className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            {availableBands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Context Description */}
      <div className="py-2 px-4 bg-gray-50 text-xs text-gray-600">
        {activeContext === 'personal' ? (
          <p>
            Your personal song catalog - songs only you can see and edit for your own practice.
          </p>
        ) : (
          <p>
            Band songs shared with all members - collaborate on setlists and arrangements together.
          </p>
        )}
      </div>
    </div>
  )
}
