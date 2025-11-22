import React, { useState } from 'react'
import { ModernLayout } from '../../components/layout/ModernLayout'
import {
  ChevronDown,
  Plus,
  Search,
  Clock,
  Music,
  Guitar,
  Activity,
  Calendar,
} from 'lucide-react'
import { NewSongModal } from '../../components/songs/NewSongModal'

interface Song {
  id: string
  title: string
  artist: string
  duration: string
  key: string
  tuning: string
  bpm: string
  nextShow?: {
    name: string
    date: string
  }
  initials: string
  avatarColor: string
}

// Demo data matching the mockup
const demoSongs: Song[] = [
  {
    id: '1',
    title: 'All Star',
    artist: 'Smash Mouth',
    duration: '3:14',
    key: 'F#',
    tuning: 'Standard',
    bpm: '104bpm',
    nextShow: { name: 'Toys 4 Tots', date: 'Dec 8th, 2025' },
    initials: 'as',
    avatarColor: '#3b82f6',
  },
  {
    id: '2',
    title: 'Man in the Box',
    artist: 'Alice In Chains',
    duration: '4:47',
    key: 'Ebm',
    tuning: 'Half-step down',
    bpm: '108bpm',
    nextShow: { name: 'Toys 4 Tots', date: 'Dec 8th, 2025' },
    initials: 'mb',
    avatarColor: '#8b5cf6',
  },
  {
    id: '3',
    title: 'No Rain',
    artist: 'Blind Melon',
    duration: '3:33',
    key: 'E',
    tuning: 'Standard',
    bpm: '150bpm',
    nextShow: { name: 'Toys 4 Tots', date: 'Dec 8th, 2025' },
    initials: 'nr',
    avatarColor: '#ec4899',
  },
  {
    id: '4',
    title: 'Monkey Wrench',
    artist: 'Foo Fighters',
    duration: '3:51',
    key: 'B',
    tuning: 'Dropped D',
    bpm: '175bpm',
    nextShow: { name: 'Toys 4 Tots', date: 'Dec 8th, 2025' },
    initials: 'mw',
    avatarColor: '#f59e0b',
  },
]

export const NewLayout: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <ModernLayout bandName="iPod Shuffle" userEmail="eric@example.com">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-2xl font-bold text-white">Songs</h1>
          <ChevronDown size={20} className="text-[#a0a0a0]" />
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors">
            <Plus size={20} />
            <span>Filter</span>
          </button>

          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]"
              />
              <input
                type="text"
                placeholder="Search songs"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-11 pr-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <Plus size={20} />
            <span>Add Song</span>
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        {/* Table Header */}
        <div className="flex items-center gap-4 px-4 pb-3 mb-2 border-b border-[#2a2a2a]">
          <div className="flex-1 min-w-[200px] text-xs font-semibold text-[#707070] uppercase tracking-wider">
            Song
          </div>
          <div className="w-[100px] flex items-center gap-2 text-xs font-semibold text-[#707070] uppercase tracking-wider">
            <Clock size={16} />
          </div>
          <div className="w-[80px] flex items-center gap-2 text-xs font-semibold text-[#707070] uppercase tracking-wider">
            <Music size={16} />
          </div>
          <div className="w-[140px] flex items-center gap-2 text-xs font-semibold text-[#707070] uppercase tracking-wider">
            <Guitar size={16} />
          </div>
          <div className="w-[100px] flex items-center gap-2 text-xs font-semibold text-[#707070] uppercase tracking-wider">
            <Activity size={16} />
          </div>
          <div className="w-[180px] flex items-center gap-2 text-xs font-semibold text-[#707070] uppercase tracking-wider">
            <Calendar size={16} />
          </div>
        </div>

        {/* Table Rows */}
        <div className="space-y-2">
          {demoSongs.map(song => (
            <div
              key={song.id}
              className="flex items-center gap-4 p-4 bg-[#1a1a1a] rounded-xl hover:bg-[#252525] transition-colors cursor-pointer"
            >
              {/* Song Info */}
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase"
                  style={{ backgroundColor: song.avatarColor }}
                >
                  {song.initials}
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">
                    {song.title}
                  </div>
                  <div className="text-[#a0a0a0] text-xs">{song.artist}</div>
                </div>
              </div>

              {/* Duration */}
              <div className="w-[100px] text-[#a0a0a0] text-sm">
                {song.duration}
              </div>

              {/* Key */}
              <div className="w-[80px] text-[#a0a0a0] text-sm">{song.key}</div>

              {/* Tuning */}
              <div className="w-[140px] text-[#a0a0a0] text-sm">
                {song.tuning}
              </div>

              {/* BPM */}
              <div className="w-[100px] text-[#a0a0a0] text-sm">{song.bpm}</div>

              {/* Next Show */}
              <div className="w-[180px]">
                {song.nextShow ? (
                  <>
                    <div className="text-white text-sm">
                      {song.nextShow.name}
                    </div>
                    <div className="text-[#a0a0a0] text-xs">
                      {song.nextShow.date}
                    </div>
                  </>
                ) : (
                  <div className="text-[#707070] text-sm">
                    No shows scheduled
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {demoSongs.map(song => (
          <div
            key={song.id}
            className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]"
          >
            {/* Song Info */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase"
                style={{ backgroundColor: song.avatarColor }}
              >
                {song.initials}
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold text-sm">
                  {song.title}
                </div>
                <div className="text-[#a0a0a0] text-xs">{song.artist}</div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex items-center gap-2 text-[#a0a0a0] text-xs">
                <Clock size={16} />
                <span>{song.duration}</span>
              </div>
              <div className="flex items-center gap-2 text-[#a0a0a0] text-xs">
                <Music size={16} />
                <span>{song.key}</span>
              </div>
              <div className="flex items-center gap-2 text-[#a0a0a0] text-xs">
                <Guitar size={16} />
                <span>{song.tuning}</span>
              </div>
              <div className="flex items-center gap-2 text-[#a0a0a0] text-xs">
                <Activity size={16} />
                <span>{song.bpm}</span>
              </div>
            </div>

            {/* Next Show */}
            {song.nextShow && (
              <div className="flex items-center gap-2 pt-3 border-t border-[#2a2a2a] text-xs">
                <Calendar size={16} className="text-[#707070]" />
                <span className="text-white">{song.nextShow.name}</span>
                <span className="text-[#a0a0a0]">{song.nextShow.date}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Demo Banner */}
      <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-blue-400 text-sm">
          <strong>Demo Page:</strong> This is a demonstration of the new layout
          design. The actual Songs page at /songs remains unchanged. Review the
          design style guide at
          .claude/specifications/2025-10-22T14:01_design-style-guide.md for full
          details.
        </p>
      </div>

      {/* New Song Modal */}
      <NewSongModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </ModernLayout>
  )
}
