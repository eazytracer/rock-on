import React, { useState, useMemo, useRef } from 'react'
import { Song } from '../../models/Song'
import { SongCard } from './SongCard'
import { SearchBar } from '../common/SearchBar'
import { LoadingSpinner } from '../common/LoadingSpinner'

interface SongListProps {
  songs: Song[]
  loading?: boolean
  onSongClick?: (song: Song) => void
  onSongEdit?: (song: Song) => void
  onSongDelete?: (song: Song) => void
  onViewLinked?: (song: Song) => void
  showSearch?: boolean
  searchPlaceholder?: string
  compactMode?: boolean
  virtualized?: boolean
  itemHeight?: number
  className?: string
}

interface VirtualizedListProps {
  items: Song[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: Song, index: number) => React.ReactNode
}

const VirtualizedList: React.FC<VirtualizedListProps> = ({
  items,
  itemHeight,
  containerHeight,
  renderItem,
}) => {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    )
    return { startIndex: Math.max(0, startIndex), endIndex }
  }, [scrollTop, itemHeight, containerHeight, items.length])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  const totalHeight = items.length * itemHeight
  const offsetY = visibleRange.startIndex * itemHeight

  return (
    <div
      ref={containerRef}
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {items
            .slice(visibleRange.startIndex, visibleRange.endIndex)
            .map((item, index) => (
              <div
                key={item.id}
                style={{ height: itemHeight }}
                className="w-full"
              >
                {renderItem(item, visibleRange.startIndex + index)}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export const SongList: React.FC<SongListProps> = ({
  songs,
  loading = false,
  onSongClick,
  onSongEdit,
  onSongDelete,
  onViewLinked,
  showSearch = true,
  searchPlaceholder = 'Search songs...',
  compactMode = false,
  virtualized = false,
  itemHeight = compactMode ? 80 : 200,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<
    'title' | 'artist' | 'difficulty' | 'lastPracticed' | 'confidence'
  >('title')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterBy] = useState<{
    difficulty?: number[]
    confidence?: 'ready' | 'needs-practice' | 'new'
    key?: string[]
  }>({})

  const filteredAndSortedSongs = useMemo(() => {
    const filtered = songs.filter(song => {
      const matchesSearch =
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.album?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.tags.some(tag =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        )

      const matchesDifficulty =
        !filterBy.difficulty?.length ||
        filterBy.difficulty.includes(song.difficulty)

      const matchesConfidence =
        !filterBy.confidence ||
        (filterBy.confidence === 'ready' && song.confidenceLevel >= 4) ||
        (filterBy.confidence === 'needs-practice' &&
          song.confidenceLevel >= 2 &&
          song.confidenceLevel < 4) ||
        (filterBy.confidence === 'new' && song.confidenceLevel < 2)

      const matchesKey =
        !filterBy.key?.length || filterBy.key.includes(song.key)

      return (
        matchesSearch && matchesDifficulty && matchesConfidence && matchesKey
      )
    })

    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'artist':
          comparison = a.artist.localeCompare(b.artist)
          break
        case 'difficulty':
          comparison = a.difficulty - b.difficulty
          break
        case 'lastPracticed': {
          const aDate = a.lastPracticed
            ? new Date(a.lastPracticed).getTime()
            : 0
          const bDate = b.lastPracticed
            ? new Date(b.lastPracticed).getTime()
            : 0
          comparison = aDate - bDate
          break
        }
        case 'confidence':
          comparison = a.confidenceLevel - b.confidenceLevel
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [songs, searchQuery, sortBy, sortOrder, filterBy])

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const renderSong = (song: Song) => (
    <div className={compactMode ? 'mb-2' : 'mb-4'}>
      <SongCard
        song={song}
        onClick={onSongClick}
        onEdit={onSongEdit}
        onDelete={onSongDelete}
        hasLinkedVariants={!!song.songGroupId}
        onViewLinked={onViewLinked}
      />
    </div>
  )

  const containerClasses = ['w-full', className].join(' ')

  if (loading) {
    return (
      <div className={containerClasses}>
        <LoadingSpinner size="lg" centered text="Loading songs..." />
      </div>
    )
  }

  return (
    <div className={containerClasses}>
      {showSearch && (
        <div className="mb-4 space-y-3">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={searchPlaceholder}
            loading={loading}
          />

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600">Sort by:</span>
            <div className="flex flex-wrap gap-1">
              {[
                { key: 'title', label: 'Title' },
                { key: 'artist', label: 'Artist' },
                { key: 'difficulty', label: 'Difficulty' },
                { key: 'confidence', label: 'Readiness' },
                { key: 'lastPracticed', label: 'Last Practiced' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleSort(key as typeof sortBy)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors touch-manipulation ${
                    sortBy === key
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label}
                  {sortBy === key && (
                    <span className="ml-1">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {filteredAndSortedSongs.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No songs found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery
              ? `No songs match "${searchQuery}"`
              : 'Get started by adding your first song.'}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredAndSortedSongs.length} of {songs.length} songs
          </div>

          {virtualized && filteredAndSortedSongs.length > 20 ? (
            <VirtualizedList
              items={filteredAndSortedSongs}
              itemHeight={itemHeight}
              containerHeight={600}
              renderItem={song => renderSong(song)}
            />
          ) : (
            <div className="space-y-2">
              {filteredAndSortedSongs.map(song => (
                <div key={song.id}>{renderSong(song)}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
