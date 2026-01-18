import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ModernLayout } from '../components/layout/ModernLayout'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  ChevronDown,
  Plus,
  Search,
  Clock,
  Music,
  Guitar,
  Activity,
  Calendar,
  MoreVertical,
  Filter,
  X,
  Copy,
  ListPlus,
  Trash2,
  Edit,
  ExternalLink,
  Play,
  Music2,
} from 'lucide-react'
// DATABASE INTEGRATION: Import database hooks and utilities
import {
  useSongs,
  useCreateSong,
  useUpdateSong,
  useDeleteSong,
} from '../hooks/useSongs'
import {
  secondsToDuration,
  durationToSeconds,
  formatBpm,
  parseBpm,
} from '../utils/formatters'
import { db } from '../services/database'
// DBSong type imported but not currently used directly
import CircleOfFifths from '../components/songs/CircleOfFifths'
// PHASE 2: Sync status visualization
import { SyncIcon } from '../components/sync/SyncIcon'
import { useItemStatus } from '../hooks/useItemSyncStatus'
// Expandable notes for songs
import { ExpandableSongNotes } from '../components/songs/ExpandableSongNotes'

interface SongLink {
  id: string
  type: 'spotify' | 'youtube' | 'ultimate-guitar' | 'other'
  name: string
  url: string
}

// DATABASE INTEGRATION: Extended Song interface for display
interface Song {
  id: string
  title: string
  artist: string
  album?: string
  duration: string // Display format: "3:14"
  key: string
  tuning: string
  bpm: string // Display format: "104 bpm"
  tempo: string
  tags: string[]
  nextShow?: {
    name: string
    date: string
  }
  initials: string
  avatarColor: string
  notes?: string
  referenceLinks?: SongLink[]
  createdDate: string
  createdBy: string
  difficulty?: number
  confidenceLevel?: number
}

// DATABASE INTEGRATION: Mock data removed - now loading from database

// Comprehensive mock data with varied songs (REMOVED - using database)
/*
const mockSongs: Song[] = [
  {
    id: '1',
    title: 'All Star',
    artist: 'Smash Mouth',
    album: 'Astro Lounge',
    duration: '3:14',
    key: 'F#',
    tuning: 'Standard',
    bpm: '104',
    tempo: 'moderate',
    tags: ['Rock', 'Cover', '90s'],
    nextShow: { name: 'Toys 4 Tots', date: 'Dec 8th, 2025' },
    initials: 'AS',
    avatarColor: '#3b82f6',
    notes: 'Fun crowd pleaser. Start with palm muted power chords.',
    referenceLinks: [
      { id: '1', type: 'youtube', name: 'YouTube Tutorial', url: 'https://youtube.com/watch1' },
      { id: '2', type: 'spotify', name: 'Spotify Track', url: 'https://spotify.com/track1' }
    ],
    createdDate: '2024-11-15',
    createdBy: 'Eric'
  },
  {
    id: '2',
    title: 'Man in the Box',
    artist: 'Alice In Chains',
    album: 'Facelift',
    duration: '4:47',
    key: 'Ebm',
    tuning: 'Half-step down',
    bpm: '108',
    tempo: 'moderate',
    tags: ['Grunge', 'Cover', '90s'],
    nextShow: { name: 'Toys 4 Tots', date: 'Dec 8th, 2025' },
    initials: 'MB',
    avatarColor: '#8b5cf6',
    notes: 'Heavy riff. Watch the wah-wah pedal timing.',
    referenceLinks: [
      { id: '1', type: 'ultimate-guitar', name: 'Tab', url: 'https://ultimate-guitar.com/tab1' }
    ],
    createdDate: '2024-11-10',
    createdBy: 'Mike'
  },
  {
    id: '3',
    title: 'No Rain',
    artist: 'Blind Melon',
    album: 'Blind Melon',
    duration: '3:33',
    key: 'E',
    tuning: 'Standard',
    bpm: '150',
    tempo: 'upbeat',
    tags: ['Alternative', 'Cover', '90s'],
    nextShow: { name: 'Toys 4 Tots', date: 'Dec 8th, 2025' },
    initials: 'NR',
    avatarColor: '#ec4899',
    notes: 'Upbeat feel-good song. Great sing-along.',
    createdDate: '2024-11-08',
    createdBy: 'Sarah'
  },
  {
    id: '4',
    title: 'Monkey Wrench',
    artist: 'Foo Fighters',
    album: 'The Colour and the Shape',
    duration: '3:51',
    key: 'B',
    tuning: 'Drop D',
    bpm: '175',
    tempo: 'fast',
    tags: ['Rock', 'Cover', 'High Energy'],
    nextShow: { name: 'Toys 4 Tots', date: 'Dec 8th, 2025' },
    initials: 'MW',
    avatarColor: '#f59e0b',
    notes: 'Fast and aggressive. Watch the tempo in the bridge.',
    createdDate: '2024-11-05',
    createdBy: 'Eric'
  },
  {
    id: '5',
    title: 'Black Hole Sun',
    artist: 'Soundgarden',
    album: 'Superunknown',
    duration: '5:18',
    key: 'G',
    tuning: 'Drop D',
    bpm: '104',
    tempo: 'moderate',
    tags: ['Grunge', 'Cover', '90s'],
    initials: 'BH',
    avatarColor: '#14b8a6',
    notes: 'Atmospheric and moody. Focus on dynamics.',
    createdDate: '2024-10-28',
    createdBy: 'Mike'
  },
  {
    id: '6',
    title: 'Everlong',
    artist: 'Foo Fighters',
    album: 'The Colour and the Shape',
    duration: '4:10',
    key: 'D',
    tuning: 'Drop D',
    bpm: '158',
    tempo: 'fast',
    tags: ['Rock', 'Cover', 'Fan Favorite'],
    initials: 'EV',
    avatarColor: '#f43f5e',
    notes: 'High energy throughout. Great closer.',
    createdDate: '2024-10-25',
    createdBy: 'Sarah'
  },
  {
    id: '7',
    title: 'Plush',
    artist: 'Stone Temple Pilots',
    album: 'Core',
    duration: '5:13',
    key: 'G',
    tuning: 'Half-step down',
    bpm: '78',
    tempo: 'slow',
    tags: ['Grunge', 'Cover', 'Ballad'],
    initials: 'PL',
    avatarColor: '#a855f7',
    notes: 'Slow burn. Watch the wah pedal on the lead.',
    createdDate: '2024-10-20',
    createdBy: 'Eric'
  },
  {
    id: '8',
    title: 'Come As You Are',
    artist: 'Nirvana',
    album: 'Nevermind',
    duration: '3:39',
    key: 'Em',
    tuning: 'Standard',
    bpm: '120',
    tempo: 'moderate',
    tags: ['Grunge', 'Cover', '90s', 'Classic'],
    nextShow: { name: 'New Year\'s Eve Bash', date: 'Dec 31st, 2025' },
    initials: 'CA',
    avatarColor: '#06b6d4',
    notes: 'Iconic riff. Use chorus pedal for authentic sound.',
    createdDate: '2024-10-18',
    createdBy: 'Mike'
  },
  {
    id: '9',
    title: 'Learn to Fly',
    artist: 'Foo Fighters',
    album: 'There Is Nothing Left to Lose',
    duration: '3:55',
    key: 'B',
    tuning: 'Standard',
    bpm: '137',
    tempo: 'moderate',
    tags: ['Rock', 'Cover', 'Upbeat'],
    nextShow: { name: 'New Year\'s Eve Bash', date: 'Dec 31st, 2025' },
    initials: 'LF',
    avatarColor: '#84cc16',
    notes: 'Melodic and sing-along friendly.',
    createdDate: '2024-10-15',
    createdBy: 'Sarah'
  },
  {
    id: '10',
    title: 'Interstate Love Song',
    artist: 'Stone Temple Pilots',
    album: 'Purple',
    duration: '3:14',
    key: 'E',
    tuning: 'Standard',
    bpm: '102',
    tempo: 'moderate',
    tags: ['Rock', 'Cover', '90s'],
    initials: 'IL',
    avatarColor: '#eab308',
    notes: 'Groovy bassline. Let it breathe.',
    createdDate: '2024-10-12',
    createdBy: 'Eric'
  },
  {
    id: '11',
    title: 'The Pretender',
    artist: 'Foo Fighters',
    album: 'Echoes, Silence, Patience & Grace',
    duration: '4:29',
    key: 'Am',
    tuning: 'Drop D',
    bpm: '174',
    tempo: 'fast',
    tags: ['Rock', 'Cover', 'High Energy'],
    nextShow: { name: 'New Year\'s Eve Bash', date: 'Dec 31st, 2025' },
    initials: 'TP',
    avatarColor: '#f97316',
    notes: 'Build from quiet to explosive. Crowd favorite.',
    createdDate: '2024-10-08',
    createdBy: 'Mike'
  },
  {
    id: '12',
    title: 'Would?',
    artist: 'Alice In Chains',
    album: 'Dirt',
    duration: '3:28',
    key: 'D',
    tuning: 'Drop D',
    bpm: '110',
    tempo: 'moderate',
    tags: ['Grunge', 'Cover', 'Heavy'],
    initials: 'WO',
    avatarColor: '#6366f1',
    notes: 'Heavy and dark. Focus on the harmony vocals.',
    createdDate: '2024-10-05',
    createdBy: 'Sarah'
  },
  {
    id: '13',
    title: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    album: 'Nevermind',
    duration: '5:01',
    key: 'F',
    tuning: 'Standard',
    bpm: '117',
    tempo: 'moderate',
    tags: ['Grunge', 'Cover', '90s', 'Classic'],
    nextShow: { name: 'New Year\'s Eve Bash', date: 'Dec 31st, 2025' },
    initials: 'ST',
    avatarColor: '#ef4444',
    notes: 'The ultimate grunge anthem. Everyone knows this one.',
    createdDate: '2024-10-01',
    createdBy: 'Eric'
  },
  {
    id: '14',
    title: 'Even Flow',
    artist: 'Pearl Jam',
    album: 'Ten',
    duration: '4:53',
    key: 'D',
    tuning: 'Standard',
    bpm: '147',
    tempo: 'fast',
    tags: ['Grunge', 'Cover', '90s'],
    initials: 'EF',
    avatarColor: '#10b981',
    notes: 'Driving rhythm. Watch for the tempo changes.',
    createdDate: '2024-09-28',
    createdBy: 'Mike'
  },
  {
    id: '15',
    title: 'Alive',
    artist: 'Pearl Jam',
    album: 'Ten',
    duration: '5:41',
    key: 'A',
    tuning: 'Standard',
    bpm: '76',
    tempo: 'moderate',
    tags: ['Grunge', 'Cover', 'Ballad', 'Epic'],
    initials: 'AL',
    avatarColor: '#8b5cf6',
    notes: 'Epic guitar solo. Great for showing off.',
    createdDate: '2024-09-25',
    createdBy: 'Sarah'
  },
  {
    id: '16',
    title: 'Scar Tissue',
    artist: 'Red Hot Chili Peppers',
    album: 'Californication',
    duration: '3:37',
    key: 'F',
    tuning: 'Standard',
    bpm: '92',
    tempo: 'slow',
    tags: ['Alternative', 'Cover', 'Laid Back'],
    initials: 'SC',
    avatarColor: '#f59e0b',
    notes: 'Laid back groove. Focus on the feel, not speed.',
    createdDate: '2024-09-20',
    createdBy: 'Eric'
  },
  {
    id: '17',
    title: 'Under the Bridge',
    artist: 'Red Hot Chili Peppers',
    album: 'Blood Sugar Sex Magik',
    duration: '4:24',
    key: 'D',
    tuning: 'Standard',
    bpm: '70',
    tempo: 'slow',
    tags: ['Alternative', 'Cover', 'Ballad'],
    initials: 'UB',
    avatarColor: '#ec4899',
    notes: 'Beautiful and melodic. Great vocal showcase.',
    createdDate: '2024-09-15',
    createdBy: 'Mike'
  },
  {
    id: '18',
    title: 'Say It Ain\'t So',
    artist: 'Weezer',
    album: 'Weezer (Blue Album)',
    duration: '4:18',
    key: 'C#m',
    tuning: 'Half-step down',
    bpm: '76',
    tempo: 'moderate',
    tags: ['Alternative', 'Cover', '90s'],
    initials: 'SI',
    avatarColor: '#3b82f6',
    notes: 'Emotional build. Watch dynamics.',
    createdDate: '2024-09-10',
    createdBy: 'Sarah'
  },
  {
    id: '19',
    title: 'Times Like These',
    artist: 'Foo Fighters',
    album: 'One by One',
    duration: '4:26',
    key: 'D',
    tuning: 'Drop D',
    bpm: '147',
    tempo: 'moderate',
    tags: ['Rock', 'Cover', 'Uplifting'],
    initials: 'TL',
    avatarColor: '#14b8a6',
    notes: 'Uplifting and anthemic. Great sing-along.',
    createdDate: '2024-09-05',
    createdBy: 'Eric'
  },
  {
    id: '20',
    title: 'Vasoline',
    artist: 'Stone Temple Pilots',
    album: 'Purple',
    duration: '2:56',
    key: 'E',
    tuning: 'Drop D',
    bpm: '127',
    tempo: 'moderate',
    tags: ['Grunge', 'Cover', '90s'],
    initials: 'VA',
    avatarColor: '#a855f7',
    notes: 'Short and punchy. High energy throughout.',
    createdDate: '2024-09-01',
    createdBy: 'Mike'
  }
]
*/

// Sort options
type SortOption =
  | 'title-asc'
  | 'title-desc'
  | 'artist-asc'
  | 'artist-desc'
  | 'date-added-desc'
  | 'date-added-asc'
  | 'show-asc'

// PHASE 2: Song row component with sync status
interface SongRowProps {
  song: Song
  onEdit: (song: Song) => void
  onDelete: (song: Song) => void
  onDuplicate: (song: Song) => void
  onAddToSetlist: (song: Song) => void
  openActionMenuId: string | null
  setOpenActionMenuId: (id: string | null) => void
  // Expandable notes props
  userId: string
  bandId: string
  isExpanded: boolean
  onToggleExpand: () => void
}

const SongRow: React.FC<SongRowProps> = ({
  song,
  onEdit,
  onDelete,
  onDuplicate,
  onAddToSetlist,
  openActionMenuId,
  setOpenActionMenuId,
  userId,
  bandId,
  isExpanded,
  onToggleExpand,
}) => {
  // PHASE 2: Get sync status for this specific song
  const syncStatus = useItemStatus(song.id)

  return (
    <div className="bg-[#1a1a1a] rounded-xl hover:bg-[#252525] transition-colors group">
      <div className="flex items-center gap-4 p-4">
        {/* PHASE 2: Sync Icon */}
        <div className="flex-shrink-0">
          <SyncIcon status={syncStatus} size="sm" />
        </div>

        {/* Song Info */}
        <div className="flex items-center gap-3 flex-1 min-w-[220px] cursor-pointer">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0"
            style={{ backgroundColor: song.avatarColor }}
          >
            {song.initials}
          </div>
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm truncate">
              {song.title}
            </div>
            <div className="text-[#a0a0a0] text-xs truncate">{song.artist}</div>
          </div>
        </div>

        {/* Duration */}
        <div className="w-[90px] text-[#a0a0a0] text-sm">{song.duration}</div>

        {/* Key */}
        <div className="w-[60px] text-[#a0a0a0] text-sm">{song.key}</div>

        {/* Tuning */}
        <div className="w-[130px] text-[#a0a0a0] text-sm">{song.tuning}</div>

        {/* BPM */}
        <div className="w-[80px] text-[#a0a0a0] text-sm">{song.bpm}</div>

        {/* Next Show */}
        <div className="w-[180px]">
          {song.nextShow ? (
            <>
              <div className="text-white text-sm">{song.nextShow.name}</div>
              <div className="text-[#a0a0a0] text-xs">{song.nextShow.date}</div>
            </>
          ) : (
            <div className="text-[#707070] text-sm">No shows scheduled</div>
          )}
        </div>

        {/* Actions Menu */}
        <div className="w-[40px] relative">
          <button
            onClick={() =>
              setOpenActionMenuId(openActionMenuId === song.id ? null : song.id)
            }
            className="p-1 text-[#707070] hover:text-white transition-colors"
            data-testid="song-actions-menu-button"
          >
            <MoreVertical size={20} />
          </button>

          {openActionMenuId === song.id && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpenActionMenuId(null)}
              />
              <div className="absolute right-0 top-8 z-20 w-48 bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden">
                <button
                  onClick={() => onEdit(song)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-white text-sm hover:bg-[#2a2a2a] transition-colors"
                  data-testid="edit-song-button"
                >
                  <Edit size={16} />
                  <span>Edit Song</span>
                </button>
                <button
                  onClick={() => onAddToSetlist(song)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-white text-sm hover:bg-[#2a2a2a] transition-colors"
                  data-testid="add-to-setlist-button"
                >
                  <ListPlus size={16} />
                  <span>Add to Setlist</span>
                </button>
                <button
                  onClick={() => onDuplicate(song)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-white text-sm hover:bg-[#2a2a2a] transition-colors"
                  data-testid="duplicate-song-button"
                >
                  <Copy size={16} />
                  <span>Duplicate Song</span>
                </button>
                <div className="h-px bg-[#2a2a2a]" />
                <button
                  onClick={() => onDelete(song)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[#D7263D] text-sm hover:bg-[#2a2a2a] transition-colors"
                  data-testid="delete-song-button"
                >
                  <Trash2 size={16} />
                  <span>Delete Song</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Expandable Notes Section */}
      <div className="px-4 pb-3">
        <ExpandableSongNotes
          songId={song.id}
          bandNotes={song.notes}
          userId={userId}
          bandId={bandId}
          isExpanded={isExpanded}
          onToggle={onToggleExpand}
        />
      </div>
    </div>
  )
}

// PHASE 2: Mobile song card component with sync status
const SongCard: React.FC<SongRowProps> = ({
  song,
  onEdit,
  onDelete,
  onDuplicate,
  onAddToSetlist,
  openActionMenuId,
  setOpenActionMenuId,
  userId,
  bandId,
  isExpanded,
  onToggleExpand,
}) => {
  // PHASE 2: Get sync status for this specific song
  const syncStatus = useItemStatus(song.id)

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]">
      {/* Song Info */}
      <div className="flex items-start gap-3 mb-3">
        {/* PHASE 2: Sync Icon */}
        <div className="flex-shrink-0 mt-1">
          <SyncIcon status={syncStatus} size="sm" />
        </div>

        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0"
          style={{ backgroundColor: song.avatarColor }}
        >
          {song.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm">{song.title}</div>
          <div className="text-[#a0a0a0] text-xs">{song.artist}</div>
        </div>
        <button
          onClick={() =>
            setOpenActionMenuId(openActionMenuId === song.id ? null : song.id)
          }
          className="p-1 text-[#707070] hover:text-white transition-colors"
        >
          <MoreVertical size={20} />
        </button>

        {/* Mobile Actions Menu */}
        {openActionMenuId === song.id && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpenActionMenuId(null)}
            />
            <div className="absolute right-4 z-20 w-48 bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden">
              <button
                onClick={() => onEdit(song)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-white text-sm hover:bg-[#2a2a2a] transition-colors"
              >
                <Edit size={16} />
                <span>Edit Song</span>
              </button>
              <button
                onClick={() => onAddToSetlist(song)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-white text-sm hover:bg-[#2a2a2a] transition-colors"
              >
                <ListPlus size={16} />
                <span>Add to Setlist</span>
              </button>
              <button
                onClick={() => onDuplicate(song)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-white text-sm hover:bg-[#2a2a2a] transition-colors"
              >
                <Copy size={16} />
                <span>Duplicate Song</span>
              </button>
              <div className="h-px bg-[#2a2a2a]" />
              <button
                onClick={() => onDelete(song)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[#D7263D] text-sm hover:bg-[#2a2a2a] transition-colors"
              >
                <Trash2 size={16} />
                <span>Delete Song</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Metadata Grid - 2 columns on wider mobile, 1 column on very small */}
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2 text-[#a0a0a0] text-xs">
          <Clock size={16} className="flex-shrink-0" />
          <span>{song.duration}</span>
        </div>
        <div className="flex items-center gap-2 text-[#a0a0a0] text-xs">
          <Music size={16} className="flex-shrink-0" />
          <span>{song.key}</span>
        </div>
        <div className="flex items-center gap-2 text-[#a0a0a0] text-xs">
          <Guitar size={16} className="flex-shrink-0" />
          <span className="truncate">{song.tuning}</span>
        </div>
        <div className="flex items-center gap-2 text-[#a0a0a0] text-xs">
          <Activity size={16} className="flex-shrink-0" />
          <span className="whitespace-nowrap">{song.bpm}</span>
        </div>
      </div>

      {/* Tags */}
      {song.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {song.tags.map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-[#2a2a2a] text-[#a0a0a0] text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Next Show */}
      {song.nextShow && (
        <div className="flex items-center gap-2 pt-3 border-t border-[#2a2a2a] text-xs">
          <Calendar size={16} className="text-[#707070] flex-shrink-0" />
          <span className="text-white truncate">{song.nextShow.name}</span>
          <span className="text-[#a0a0a0] whitespace-nowrap">
            {song.nextShow.date}
          </span>
        </div>
      )}
      {!song.nextShow && (
        <div className="flex items-center gap-2 pt-3 border-t border-[#2a2a2a] text-xs">
          <Calendar size={16} className="text-[#707070] flex-shrink-0" />
          <span className="text-[#707070]">No shows scheduled</span>
        </div>
      )}

      {/* Expandable Notes Section */}
      <div className="mt-3">
        <ExpandableSongNotes
          songId={song.id}
          bandNotes={song.notes}
          userId={userId}
          bandId={bandId}
          isExpanded={isExpanded}
          onToggle={onToggleExpand}
        />
      </div>
    </div>
  )
}

export const SongsPage: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // DATABASE INTEGRATION: Get currentBandId from localStorage
  const currentBandId = localStorage.getItem('currentBandId') || ''
  const currentUserId = localStorage.getItem('currentUserId') || ''

  // DATABASE INTEGRATION: Use database hooks instead of mock state
  const { songs: dbSongs, loading, error, refetch } = useSongs(currentBandId)
  const { createSong } = useCreateSong()
  const { updateSong } = useUpdateSong()
  const { deleteSong, checkSongInSetlists } = useDeleteSong()

  // Display songs with transformed data
  const [songs, setSongs] = useState<Song[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTuning, setSelectedTuning] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedShow, setSelectedShow] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortOption>('title-asc')
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSetlistMenuOpen, setIsSetlistMenuOpen] = useState(false)
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null)
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null)
  // State for tracking songs in setlists - reserved for future feature

  // DATABASE INTEGRATION: Transform database songs to display format and calculate "Next Show"
  useEffect(() => {
    const transformSongs = async () => {
      if (!dbSongs || dbSongs.length === 0) {
        setSongs([])
        return
      }

      try {
        const transformedSongs = await Promise.all(
          dbSongs.map(async dbSong => {
            // DATABASE INTEGRATION: Calculate "Next Show" for each song
            let nextShow: { name: string; date: string } | undefined

            try {
              // Find setlists containing this song
              const setlists = await db.setlists
                .filter(setlist =>
                  setlist.items?.some(
                    item => item.type === 'song' && item.songId === dbSong.id
                  )
                )
                .toArray()

              if (setlists.length > 0) {
                // For each setlist, check if it has a linked show
                for (const setlist of setlists) {
                  if (setlist.showId) {
                    // Load the show from dedicated shows table
                    const show = await db.shows.get(setlist.showId)

                    if (show && show.scheduledDate) {
                      const showDate = new Date(show.scheduledDate)
                      const now = new Date()

                      // Only consider upcoming shows
                      if (showDate >= now) {
                        // Use the nearest upcoming show
                        if (!nextShow) {
                          nextShow = {
                            name: show.name || 'Upcoming Show',
                            date: showDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }),
                          }
                        } else {
                          const currentNextDate = new Date(nextShow.date)
                          if (showDate < currentNextDate) {
                            nextShow = {
                              name: show.name || 'Upcoming Show',
                              date: showDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              }),
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.error(
                'Error calculating next show for song:',
                dbSong.id,
                err
              )
            }

            // DATABASE INTEGRATION: Transform database format to display format
            // Generate initials from title
            const initials = dbSong.title
              .split(' ')
              .slice(0, 2)
              .map(word => word[0])
              .join('')
              .toUpperCase()

            // Random color (consistent for each song by using ID)
            const colors = [
              '#3b82f6',
              '#8b5cf6',
              '#ec4899',
              '#f59e0b',
              '#14b8a6',
              '#ef4444',
              '#10b981',
              '#a855f7',
            ]
            const colorIndex =
              parseInt(dbSong.id.replace(/\D/g, '').slice(0, 8), 10) %
              colors.length
            const avatarColor = colors[colorIndex]

            // Determine tempo from BPM
            const tempo =
              dbSong.bpm > 140 ? 'fast' : dbSong.bpm < 90 ? 'slow' : 'moderate'

            return {
              id: dbSong.id,
              title: dbSong.title,
              artist: dbSong.artist,
              album: dbSong.album,
              duration: secondsToDuration(dbSong.duration), // Convert seconds to "3:14"
              key: dbSong.key,
              tuning: dbSong.guitarTuning || 'Standard',
              bpm: formatBpm(dbSong.bpm), // Convert 104 to "104 bpm"
              tempo,
              tags: dbSong.tags || [],
              nextShow,
              initials,
              avatarColor,
              notes: dbSong.notes,
              referenceLinks: dbSong.referenceLinks as SongLink[] | undefined,
              createdDate: new Date(dbSong.createdDate)
                .toISOString()
                .split('T')[0],
              createdBy: dbSong.createdBy,
              difficulty: dbSong.difficulty,
              confidenceLevel: dbSong.confidenceLevel,
            } as Song
          })
        )

        setSongs(transformedSongs)
      } catch (err) {
        console.error('Error transforming songs:', err)
      }
    }

    transformSongs()
  }, [dbSongs])

  // Extract unique tunings, tags, and shows for filters
  const availableTunings = useMemo(() => {
    return Array.from(new Set(songs.map(s => s.tuning))).sort()
  }, [songs])

  const availableTags = useMemo(() => {
    return Array.from(new Set(songs.flatMap(s => s.tags))).sort()
  }, [songs])

  const availableShows = useMemo(() => {
    return Array.from(
      new Set(songs.filter(s => s.nextShow).map(s => s.nextShow!.name))
    ).sort()
  }, [songs])

  // Filter and sort songs
  const filteredAndSortedSongs = useMemo(() => {
    let filtered = songs

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        song =>
          song.title.toLowerCase().includes(query) ||
          song.artist.toLowerCase().includes(query) ||
          song.album?.toLowerCase().includes(query)
      )
    }

    // Apply tuning filter
    if (selectedTuning) {
      filtered = filtered.filter(song => song.tuning === selectedTuning)
    }

    // Apply tags filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(song =>
        selectedTags.some(tag => song.tags.includes(tag))
      )
    }

    // Apply show filter
    if (selectedShow) {
      filtered = filtered.filter(song => song.nextShow?.name === selectedShow)
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return a.title.localeCompare(b.title)
        case 'title-desc':
          return b.title.localeCompare(a.title)
        case 'artist-asc':
          return a.artist.localeCompare(b.artist)
        case 'artist-desc':
          return b.artist.localeCompare(a.artist)
        case 'date-added-desc':
          return (
            new Date(b.createdDate).getTime() -
            new Date(a.createdDate).getTime()
          )
        case 'date-added-asc':
          return (
            new Date(a.createdDate).getTime() -
            new Date(b.createdDate).getTime()
          )
        case 'show-asc':
          if (!a.nextShow && !b.nextShow) return 0
          if (!a.nextShow) return 1
          if (!b.nextShow) return -1
          return a.nextShow.name.localeCompare(b.nextShow.name)
        default:
          return 0
      }
    })

    return filtered
  }, [songs, searchQuery, selectedTuning, selectedTags, selectedShow, sortBy])

  // Count active filters
  const activeFilterCount = [
    selectedTuning,
    ...selectedTags,
    selectedShow,
  ].filter(Boolean).length

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedTuning('')
    setSelectedTags([])
    setSelectedShow('')
  }

  // DATABASE INTEGRATION: Handle duplicate song
  const handleDuplicate = async (song: Song) => {
    try {
      // Convert display formats back to database formats
      const duration = durationToSeconds(song.duration)
      const bpm = parseBpm(song.bpm)

      await createSong({
        title: `${song.title} (Copy)`,
        artist: song.artist,
        album: song.album,
        duration,
        key: song.key,
        bpm,
        difficulty: (song.difficulty || 1) as 1 | 2 | 3 | 4 | 5,
        guitarTuning: song.tuning,
        structure: [],
        chords: [],
        tags: song.tags || [],
        notes: song.notes,
        referenceLinks:
          song.referenceLinks?.map(link => ({
            ...link,
            type:
              link.type === 'ultimate-guitar'
                ? ('tabs' as const)
                : (link.type as
                    | 'spotify'
                    | 'youtube'
                    | 'tabs'
                    | 'lyrics'
                    | 'other'),
          })) || [],
        contextType: 'band',
        contextId: currentBandId,
        createdBy: currentUserId,
        visibility: 'band',
        confidenceLevel: song.confidenceLevel || 1,
      })

      // Refetch songs to update UI
      await refetch()

      // Show success toast
      showToast(`Successfully duplicated "${song.title}"`, 'success')
    } catch (err) {
      console.error('Error duplicating song:', err)
      showToast('Failed to duplicate song. Please try again.', 'error')
    }
    setOpenActionMenuId(null)
  }

  // DATABASE INTEGRATION: Handle delete song
  const handleDelete = async (song: Song) => {
    try {
      console.log(`
┌─────────────────────────────────────────────────────────────┐
│ 🗑️  DELETE FLOW STARTED                                      │
│ Song ID: ${song.id.substring(0, 8)}...                        │
│ Song Title: "${song.title}"                                   │
│ Current song count: ${songs.length}                            │
└─────────────────────────────────────────────────────────────┘
      `)

      // Check if song is in any setlists
      const setlists = await checkSongInSetlists(song.id)

      if (setlists.length > 0) {
        const setlistNames = setlists.map(s => s.name).join(', ')
        const confirmed = window.confirm(
          `This song is in ${setlists.length} setlist(s): ${setlistNames}.\n\nDeleting will remove it from all setlists. Continue?`
        )

        if (!confirmed) {
          setOpenActionMenuId(null)
          return
        }
      } else {
        const confirmed = window.confirm(
          `Are you sure you want to delete "${song.title}" by ${song.artist}?\n\nThis action cannot be undone.`
        )

        if (!confirmed) {
          setOpenActionMenuId(null)
          return
        }
      }

      // Delete the song (hook handles setlist cleanup)
      console.log('[SongsPage] Step 1: Calling deleteSong()...')
      await deleteSong(song.id)
      console.log('[SongsPage] Step 1: deleteSong() completed')

      // Refetch songs to update UI
      console.log('[SongsPage] Step 2: Calling refetch()...')
      await refetch()
      console.log(
        '[SongsPage] Step 2: refetch() completed, new song count:',
        songs.length
      )

      // Show success toast
      showToast(`Successfully deleted "${song.title}"`, 'success')
      console.log('✅ DELETE FLOW COMPLETED')
    } catch (err) {
      console.error('❌ DELETE FLOW FAILED:', err)
      showToast('Failed to delete song. Please try again.', 'error')
    }
    setOpenActionMenuId(null)
  }

  // Legacy method for delete dialog (now unused but kept for compatibility)
  const confirmDelete = async () => {
    if (selectedSong) {
      await handleDelete(selectedSong)
      setIsDeleteDialogOpen(false)
      setSelectedSong(null)
    }
  }

  // Handle edit song
  const handleEdit = (song: Song) => {
    setSelectedSong(song)
    setIsEditModalOpen(true)
    setOpenActionMenuId(null)
  }

  // Handle add to setlist
  const handleAddToSetlist = (song: Song) => {
    setSelectedSong(song)
    setIsSetlistMenuOpen(true)
    setOpenActionMenuId(null)
  }

  // Toggle tag selection
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  // Get auth context for user info and sign out
  const { currentUser, currentBand, signOut } = useAuth()

  const handleSignOut = async () => {
    // signOut() now calls logout() internally to clear all state
    await signOut()
    navigate('/auth')
  }

  return (
    <ModernLayout
      bandName={currentBand?.name || 'No Band Selected'}
      userEmail={currentUser?.email || 'Not logged in'}
      onSignOut={handleSignOut}
    >
      <div className="max-w-6xl mx-auto">
        {/* DATABASE INTEGRATION: Show loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-white">Loading songs...</div>
          </div>
        )}

        {/* DATABASE INTEGRATION: Show error state */}
        {error && (
          <div className="flex items-center justify-center py-16">
            <div className="text-red-500">
              Error loading songs: {error.message}
            </div>
          </div>
        )}

        {/* Page Header */}
        {!loading && !error && (
          <>
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-6">
                <h1 className="text-2xl font-bold text-white">Songs</h1>
                <ChevronDown size={20} className="text-[#a0a0a0]" />
                {/* DATABASE INTEGRATION: Show song count */}
                <span className="text-sm text-[#a0a0a0] ml-2">
                  ({songs.length} songs)
                </span>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <button
                  onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    activeFilterCount > 0
                      ? 'border-[#f17827ff] bg-[#f17827ff]/10 text-[#f17827ff]'
                      : 'border-[#2a2a2a] bg-transparent text-white hover:bg-[#1f1f1f]'
                  }`}
                >
                  <Filter size={20} />
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-[#f17827ff] text-white text-xs rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <Search
                      size={20}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]"
                    />
                    <input
                      type="text"
                      placeholder="Search songs, artists, albums..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full h-10 pl-11 pr-10 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707070] hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Sort Dropdown */}
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortOption)}
                    className="h-10 px-4 pr-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm hover:bg-[#1f1f1f] transition-colors focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  >
                    <option value="title-asc">Title (A-Z)</option>
                    <option value="title-desc">Title (Z-A)</option>
                    <option value="artist-asc">Artist (A-Z)</option>
                    <option value="artist-desc">Artist (Z-A)</option>
                    <option value="date-added-desc">Recently Added</option>
                    <option value="date-added-asc">Oldest First</option>
                    <option value="show-asc">By Show</option>
                  </select>

                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66620] transition-colors"
                    data-testid="add-song-button"
                  >
                    <Plus size={20} />
                    <span>Add Song</span>
                  </button>
                </div>
              </div>

              {/* Filter Panel */}
              {isFilterPanelOpen && (
                <div className="mt-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">
                      Filters
                    </h3>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="text-xs text-[#f17827ff] hover:text-[#d66620] transition-colors"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Tuning Filter */}
                    <div>
                      <label className="block text-xs text-[#a0a0a0] mb-2">
                        Guitar Tuning
                      </label>
                      <select
                        value={selectedTuning}
                        onChange={e => setSelectedTuning(e.target.value)}
                        className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                      >
                        <option value="">All Tunings</option>
                        {availableTunings.map(tuning => (
                          <option key={tuning} value={tuning}>
                            {tuning}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Show Filter */}
                    <div>
                      <label className="block text-xs text-[#a0a0a0] mb-2">
                        Upcoming Show
                      </label>
                      <select
                        value={selectedShow}
                        onChange={e => setSelectedShow(e.target.value)}
                        className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                      >
                        <option value="">All Shows</option>
                        {availableShows.map(show => (
                          <option key={show} value={show}>
                            {show}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tags Filter */}
                    <div>
                      <label className="block text-xs text-[#a0a0a0] mb-2">
                        Tags
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                              selectedTags.includes(tag)
                                ? 'bg-[#f17827ff] text-white'
                                : 'bg-[#2a2a2a] text-[#a0a0a0] hover:bg-[#3a3a3a]'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Active Filters Display */}
                  {activeFilterCount > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                      <div className="flex flex-wrap gap-2">
                        {selectedTuning && (
                          <div className="flex items-center gap-1 px-3 py-1 bg-[#2a2a2a] text-white text-xs rounded-lg">
                            <span>{selectedTuning}</span>
                            <button
                              onClick={() => setSelectedTuning('')}
                              className="text-[#a0a0a0] hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                        {selectedTags.map(tag => (
                          <div
                            key={tag}
                            className="flex items-center gap-1 px-3 py-1 bg-[#2a2a2a] text-white text-xs rounded-lg"
                          >
                            <span>{tag}</span>
                            <button
                              onClick={() => toggleTag(tag)}
                              className="text-[#a0a0a0] hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {selectedShow && (
                          <div className="flex items-center gap-1 px-3 py-1 bg-[#2a2a2a] text-white text-xs rounded-lg">
                            <span>{selectedShow}</span>
                            <button
                              onClick={() => setSelectedShow('')}
                              className="text-[#a0a0a0] hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Empty State */}
            {filteredAndSortedSongs.length === 0 &&
              !searchQuery &&
              activeFilterCount === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 mb-4 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                    <Music size={32} className="text-[#707070]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    No songs yet
                  </h3>
                  <p className="text-sm text-[#a0a0a0] mb-6">
                    Add your first song to get started
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66620] transition-colors"
                    data-testid="add-song-button"
                  >
                    <Plus size={20} />
                    <span>Add Song</span>
                  </button>
                </div>
              )}

            {/* No Results State */}
            {filteredAndSortedSongs.length === 0 &&
              (searchQuery || activeFilterCount > 0) && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 mb-4 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                    <Search size={32} className="text-[#707070]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    No results found
                  </h3>
                  <p className="text-sm text-[#a0a0a0] mb-6">
                    Try adjusting your search or filters
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      clearAllFilters()
                    }}
                    className="text-sm text-[#f17827ff] hover:text-[#d66620] transition-colors"
                  >
                    Clear all filters
                  </button>
                </div>
              )}

            {/* Desktop Table View */}
            {filteredAndSortedSongs.length > 0 && (
              <div className="hidden xl:block">
                {/* Table Header */}
                <div className="flex items-center gap-4 px-4 pb-3 mb-2 border-b border-[#2a2a2a]">
                  <div className="flex-1 min-w-[220px] text-xs font-semibold text-[#707070] uppercase tracking-wider">
                    Song
                  </div>
                  <div className="w-[90px] flex items-center gap-2 text-xs font-semibold text-[#707070] uppercase tracking-wider">
                    <Clock size={16} />
                  </div>
                  <div className="w-[60px] flex items-center gap-2 text-xs font-semibold text-[#707070] uppercase tracking-wider">
                    <Music size={16} />
                  </div>
                  <div className="w-[130px] flex items-center gap-2 text-xs font-semibold text-[#707070] uppercase tracking-wider">
                    <Guitar size={16} />
                  </div>
                  <div className="w-[80px] flex items-center gap-2 text-xs font-semibold text-[#707070] uppercase tracking-wider">
                    <Activity size={16} />
                  </div>
                  <div className="w-[180px] flex items-center gap-2 text-xs font-semibold text-[#707070] uppercase tracking-wider">
                    <Calendar size={16} />
                  </div>
                  <div className="w-[40px]"></div>
                </div>

                {/* Table Rows - PHASE 2: Using SongRow component with sync status */}
                <div className="space-y-2">
                  {filteredAndSortedSongs.map(song => (
                    <SongRow
                      key={song.id}
                      song={song}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onDuplicate={handleDuplicate}
                      onAddToSetlist={handleAddToSetlist}
                      openActionMenuId={openActionMenuId}
                      setOpenActionMenuId={setOpenActionMenuId}
                      userId={currentUserId}
                      bandId={currentBandId}
                      isExpanded={expandedSongId === song.id}
                      onToggleExpand={() =>
                        setExpandedSongId(
                          expandedSongId === song.id ? null : song.id
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Mobile Card View - PHASE 2: Using SongCard component with sync status */}
            {filteredAndSortedSongs.length > 0 && (
              <div className="xl:hidden space-y-3 min-w-[280px]">
                {filteredAndSortedSongs.map(song => (
                  <SongCard
                    key={song.id}
                    song={song}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onAddToSetlist={handleAddToSetlist}
                    openActionMenuId={openActionMenuId}
                    setOpenActionMenuId={setOpenActionMenuId}
                    userId={currentUserId}
                    bandId={currentBandId}
                    isExpanded={expandedSongId === song.id}
                    onToggleExpand={() =>
                      setExpandedSongId(
                        expandedSongId === song.id ? null : song.id
                      )
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* DATABASE INTEGRATION: Add Song Modal with database operations */}
        {isAddModalOpen && (
          <AddEditSongModal
            mode="add"
            onClose={() => setIsAddModalOpen(false)}
            onSave={async newSong => {
              try {
                // Convert display formats to database formats
                const duration = durationToSeconds(newSong.duration)
                const bpm = parseBpm(newSong.bpm)

                await createSong({
                  title: newSong.title,
                  artist: newSong.artist,
                  album: newSong.album,
                  duration,
                  key: newSong.key,
                  bpm,
                  difficulty: (newSong.difficulty || 1) as 1 | 2 | 3 | 4 | 5,
                  guitarTuning: newSong.tuning,
                  structure: [],
                  chords: [],
                  tags: newSong.tags || [],
                  notes: newSong.notes,
                  referenceLinks:
                    newSong.referenceLinks?.map(link => ({
                      ...link,
                      type:
                        link.type === 'ultimate-guitar'
                          ? ('tabs' as const)
                          : (link.type as
                              | 'spotify'
                              | 'youtube'
                              | 'tabs'
                              | 'lyrics'
                              | 'other'),
                    })) || [],
                  contextType: 'band',
                  contextId: currentBandId,
                  createdBy: currentUserId,
                  visibility: 'band',
                  confidenceLevel: newSong.confidenceLevel || 1,
                })

                // Refetch songs to update UI
                await refetch()

                showToast(`Successfully added "${newSong.title}"`, 'success')
                setIsAddModalOpen(false)
              } catch (err) {
                console.error('Error creating song:', err)
                showToast('Failed to create song. Please try again.', 'error')
              }
            }}
            currentUserId={currentUserId}
          />
        )}

        {/* DATABASE INTEGRATION: Edit Song Modal with database operations */}
        {isEditModalOpen && selectedSong && (
          <AddEditSongModal
            mode="edit"
            song={selectedSong}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedSong(null)
            }}
            onSave={async updatedSong => {
              try {
                // Convert display formats to database formats
                const duration = durationToSeconds(updatedSong.duration)
                const bpm = parseBpm(updatedSong.bpm)

                await updateSong(updatedSong.id, {
                  title: updatedSong.title,
                  artist: updatedSong.artist,
                  album: updatedSong.album,
                  duration,
                  key: updatedSong.key,
                  bpm,
                  difficulty: (updatedSong.difficulty || 1) as
                    | 1
                    | 2
                    | 3
                    | 4
                    | 5,
                  guitarTuning: updatedSong.tuning,
                  tags: updatedSong.tags || [],
                  notes: updatedSong.notes,
                  referenceLinks:
                    updatedSong.referenceLinks?.map(link => ({
                      ...link,
                      type:
                        link.type === 'ultimate-guitar'
                          ? ('tabs' as const)
                          : (link.type as
                              | 'spotify'
                              | 'youtube'
                              | 'tabs'
                              | 'lyrics'
                              | 'other'),
                    })) || [],
                  confidenceLevel: updatedSong.confidenceLevel || 1,
                })

                // Refetch songs to update UI
                await refetch()

                showToast(
                  `Successfully updated "${updatedSong.title}"`,
                  'success'
                )
                setIsEditModalOpen(false)
                setSelectedSong(null)
              } catch (err) {
                console.error('Error updating song:', err)
                showToast('Failed to update song. Please try again.', 'error')
              }
            }}
            currentUserId={currentUserId}
          />
        )}

        {/* Delete Confirmation Dialog */}
        {isDeleteDialogOpen && selectedSong && (
          <DeleteConfirmationDialog
            song={selectedSong}
            onConfirm={confirmDelete}
            onCancel={() => {
              setIsDeleteDialogOpen(false)
              setSelectedSong(null)
            }}
          />
        )}

        {/* Add to Setlist Menu */}
        {isSetlistMenuOpen && selectedSong && (
          <AddToSetlistMenu
            song={selectedSong}
            onClose={() => {
              setIsSetlistMenuOpen(false)
              setSelectedSong(null)
            }}
          />
        )}
      </div>
    </ModernLayout>
  )
}

// DATABASE INTEGRATION: Add/Edit Song Modal Component with async save support
interface AddEditSongModalProps {
  mode: 'add' | 'edit'
  song?: Song
  onClose: () => void
  onSave: (song: Song) => void | Promise<void>
  currentUserId: string
}

const AddEditSongModal: React.FC<AddEditSongModalProps> = ({
  mode,
  song,
  onClose,
  onSave,
  currentUserId,
}) => {
  const [formData, setFormData] = useState({
    title: song?.title || '',
    artist: song?.artist || '',
    album: song?.album || '',
    durationMin: song?.duration.split(':')[0] || '',
    durationSec: song?.duration.split(':')[1] || '',
    key: song?.key || '',
    tuning: song?.tuning || 'Standard',
    bpm: song?.bpm || '',
    tags: song?.tags.join(', ') || '',
    notes: song?.notes || '',
  })

  // Circle of Fifths visibility state
  const [showCircleOfFifths, setShowCircleOfFifths] = useState(false)

  // Link management state
  const [links, setLinks] = useState<SongLink[]>(song?.referenceLinks || [])
  const [linkType, setLinkType] = useState<
    'spotify' | 'youtube' | 'ultimate-guitar' | 'other'
  >('youtube')
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)

  // Preset link names based on type
  const getLinkPresetName = (type: string) => {
    switch (type) {
      case 'spotify':
        return 'Spotify Track'
      case 'youtube':
        return 'YouTube Video'
      case 'ultimate-guitar':
        return 'Ultimate-Guitar Tab'
      case 'other':
        return ''
      default:
        return ''
    }
  }

  // Update link name when type changes
  const handleLinkTypeChange = (newType: typeof linkType) => {
    setLinkType(newType)
    if (!editingLinkId) {
      setLinkName(getLinkPresetName(newType))
    }
  }

  // Add or update link
  const handleAddLink = () => {
    if (!linkUrl.trim()) {
      alert('Please enter a URL')
      return
    }

    const finalName = linkName.trim() || getLinkPresetName(linkType)

    if (editingLinkId) {
      // Update existing link
      setLinks(
        links.map(link =>
          link.id === editingLinkId
            ? { ...link, type: linkType, name: finalName, url: linkUrl.trim() }
            : link
        )
      )
      setEditingLinkId(null)
    } else {
      // Add new link
      const newLink: SongLink = {
        id: `${Date.now()}`,
        type: linkType,
        name: finalName,
        url: linkUrl.trim(),
      }
      setLinks([...links, newLink])
    }

    // Reset form
    setLinkType('youtube')
    setLinkName('')
    setLinkUrl('')
  }

  // Edit link
  const handleEditLink = (link: SongLink) => {
    setEditingLinkId(link.id)
    setLinkType(link.type)
    setLinkName(link.name)
    setLinkUrl(link.url)
  }

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingLinkId(null)
    setLinkType('youtube')
    setLinkName('')
    setLinkUrl('')
  }

  // Delete link
  const handleDeleteLink = (linkId: string) => {
    setLinks(links.filter(link => link.id !== linkId))
  }

  // Get icon for link type
  const getLinkIcon = (type: string) => {
    switch (type) {
      case 'spotify':
        return <Music2 size={16} className="text-[#1DB954]" />
      case 'youtube':
        return <Play size={16} className="text-[#FF0000]" />
      case 'ultimate-guitar':
        return <Guitar size={16} className="text-[#FFC600]" />
      default:
        return <ExternalLink size={16} className="text-[#a0a0a0]" />
    }
  }

  // DATABASE INTEGRATION: Async submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.title || !formData.artist || !formData.key) {
      alert('Please fill in all required fields (Title, Artist, Key)')
      return
    }

    const duration = `${formData.durationMin.padStart(1, '0')}:${formData.durationSec.padStart(2, '0')}`
    const tags = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    // Generate initials from title
    const initials = formData.title
      .split(' ')
      .slice(0, 2)
      .map(word => word[0])
      .join('')
      .toUpperCase()

    // Random color for new songs
    const colors = [
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
      '#f59e0b',
      '#14b8a6',
      '#ef4444',
      '#10b981',
      '#a855f7',
    ]
    const avatarColor =
      song?.avatarColor || colors[Math.floor(Math.random() * colors.length)]

    const savedSong: Song = {
      id: song?.id || crypto.randomUUID(),
      title: formData.title,
      artist: formData.artist,
      album: formData.album || undefined,
      duration,
      key: formData.key,
      tuning: formData.tuning,
      bpm: formData.bpm,
      tempo:
        parseInt(formData.bpm) > 140
          ? 'fast'
          : parseInt(formData.bpm) < 90
            ? 'slow'
            : 'moderate',
      tags,
      nextShow: song?.nextShow,
      initials,
      avatarColor,
      notes: formData.notes || undefined,
      referenceLinks: links.length > 0 ? links : undefined,
      createdDate: song?.createdDate || new Date().toISOString().split('T')[0],
      createdBy: song?.createdBy || currentUserId,
      difficulty: song?.difficulty,
      confidenceLevel: song?.confidenceLevel,
    }

    // DATABASE INTEGRATION: Call async onSave
    await onSave(savedSong)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      data-testid="song-form-modal"
    >
      <div
        className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar-thin"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white font-medium">Songs</span>
            <span className="text-[#707070]">&gt;</span>
            <span className="text-[#a0a0a0]">
              {mode === 'add' ? 'New Song' : 'Edit Song'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#707070] hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label
                  htmlFor="song-title"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Title <span className="text-[#D7263D]">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  id="song-title"
                  data-testid="song-title-input"
                  value={formData.title}
                  onChange={e =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter song title"
                  className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  required
                />
              </div>

              {/* Artist */}
              <div>
                <label
                  htmlFor="song-artist"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Artist <span className="text-[#D7263D]">*</span>
                </label>
                <input
                  type="text"
                  name="artist"
                  id="song-artist"
                  data-testid="song-artist-input"
                  value={formData.artist}
                  onChange={e =>
                    setFormData({ ...formData, artist: e.target.value })
                  }
                  placeholder="Enter artist name"
                  className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  required
                />
              </div>

              {/* Album */}
              <div>
                <label
                  htmlFor="song-album"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Album
                </label>
                <input
                  type="text"
                  name="album"
                  id="song-album"
                  data-testid="song-album-input"
                  value={formData.album}
                  onChange={e =>
                    setFormData({ ...formData, album: e.target.value })
                  }
                  placeholder="Enter album name"
                  className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                />
              </div>

              {/* Duration, BPM, Key Row */}
              <div className="grid grid-cols-3 gap-3">
                {/* Duration */}
                <div>
                  <label className="block text-sm text-[#a0a0a0] mb-2">
                    Duration
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      name="durationMinutes"
                      id="song-duration-minutes"
                      data-testid="song-duration-minutes-input"
                      value={formData.durationMin}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          durationMin: e.target.value.replace(/\D/g, ''),
                        })
                      }
                      placeholder="0"
                      maxLength={2}
                      className="w-full h-11 px-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm text-center placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                    />
                    <span className="flex items-center text-[#505050]">:</span>
                    <input
                      type="text"
                      name="durationSeconds"
                      id="song-duration-seconds"
                      data-testid="song-duration-seconds-input"
                      value={formData.durationSec}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          durationSec: e.target.value.replace(/\D/g, ''),
                        })
                      }
                      placeholder="00"
                      maxLength={2}
                      className="w-full h-11 px-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm text-center placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                    />
                  </div>
                </div>

                {/* BPM */}
                <div>
                  <label
                    htmlFor="song-bpm"
                    className="block text-sm text-[#a0a0a0] mb-2"
                  >
                    BPM
                  </label>
                  <input
                    type="text"
                    name="bpm"
                    id="song-bpm"
                    data-testid="song-bpm-input"
                    value={formData.bpm}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        bpm: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    placeholder="120"
                    className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm text-center placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  />
                </div>

                {/* Key */}
                <div>
                  <label className="block text-sm text-[#a0a0a0] mb-2">
                    Key <span className="text-[#D7263D]">*</span>
                  </label>
                  <button
                    type="button"
                    id="song-key"
                    data-testid="song-key-button"
                    onClick={() => setShowCircleOfFifths(true)}
                    className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm flex items-center justify-between hover:border-[#f17827ff] transition-colors group"
                  >
                    <span
                      className={
                        formData.key
                          ? 'text-white font-medium'
                          : 'text-[#505050]'
                      }
                    >
                      {formData.key || 'Select key'}
                    </span>
                    <Music
                      size={18}
                      className="text-[#707070] group-hover:text-[#f17827ff] transition-colors"
                    />
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label
                  htmlFor="song-tags"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  name="tags"
                  id="song-tags"
                  data-testid="song-tags-input"
                  value={formData.tags}
                  onChange={e =>
                    setFormData({ ...formData, tags: e.target.value })
                  }
                  placeholder="Rock, Cover, 90s"
                  className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Guitar Tuning */}
              <div>
                <label
                  htmlFor="song-tuning"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Guitar Tuning
                </label>
                <select
                  name="tuning"
                  id="song-tuning"
                  data-testid="song-tuning-select"
                  value={formData.tuning}
                  onChange={e =>
                    setFormData({ ...formData, tuning: e.target.value })
                  }
                  className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                >
                  <option value="Standard">Standard</option>
                  <option value="Drop D">Drop D</option>
                  <option value="Drop C#">Drop C#</option>
                  <option value="Drop C">Drop C</option>
                  <option value="Drop B">Drop B</option>
                  <option value="Half-step down">Half-step down</option>
                  <option value="Whole-step down">Whole-step down</option>
                  <option value="Open G">Open G</option>
                  <option value="Open D">Open D</option>
                  <option value="DADGAD">DADGAD</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor="song-notes"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Notes
                </label>
                <textarea
                  name="notes"
                  id="song-notes"
                  data-testid="song-notes-textarea"
                  value={formData.notes}
                  onChange={e =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Add notes about the song..."
                  rows={5}
                  className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 resize-none"
                />
              </div>

              {/* Reference Links */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">
                  Reference Links
                </label>

                {/* Link Input Form */}
                <div className="space-y-3 mb-4">
                  {/* Link Type Dropdown */}
                  <select
                    value={linkType}
                    onChange={e =>
                      handleLinkTypeChange(e.target.value as typeof linkType)
                    }
                    className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="spotify">Spotify</option>
                    <option value="ultimate-guitar">Ultimate-Guitar</option>
                    <option value="other">Other</option>
                  </select>

                  {/* Link Name Input */}
                  <input
                    type="text"
                    value={linkName}
                    onChange={e => setLinkName(e.target.value)}
                    placeholder={getLinkPresetName(linkType) || 'Link name'}
                    className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  />

                  {/* URL Input */}
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  />

                  {/* Add/Update Button */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddLink}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#f17827ff] text-white text-sm font-medium rounded-lg hover:bg-[#d66620] transition-colors"
                    >
                      <Plus size={16} />
                      <span>{editingLinkId ? 'Update Link' : 'Add Link'}</span>
                    </button>
                    {editingLinkId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-4 py-2 text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Links List */}
                {links.length > 0 && (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar-thin">
                    {links.map(link => (
                      <div
                        key={link.id}
                        className="flex items-center gap-2 p-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg group hover:border-[#3a3a3a] transition-colors"
                      >
                        {/* Icon */}
                        <div className="flex-shrink-0">
                          {getLinkIcon(link.type)}
                        </div>

                        {/* Link Info */}
                        <div className="flex-1 min-w-0">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white text-sm hover:text-[#f17827ff] transition-colors truncate block"
                          >
                            {link.name}
                          </a>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditLink(link)}
                            className="p-1.5 text-[#707070] hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
                            title="Edit link"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLink(link.id)}
                            className="p-1.5 text-[#707070] hover:text-[#D7263D] hover:bg-[#2a2a2a] rounded transition-colors"
                            title="Delete link"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {links.length === 0 && (
                  <p className="text-xs text-[#505050] text-center py-4">
                    No links added yet
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-[#2a2a2a]">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="song-submit-button"
              className="px-6 py-2.5 bg-[#f17827ff] text-white text-sm font-medium rounded-lg hover:bg-[#d66620] transition-colors"
            >
              {mode === 'add' ? 'Create Song' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Circle of Fifths Modal */}
      {showCircleOfFifths && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowCircleOfFifths(false)}
        >
          <div
            className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-4 sm:p-6 w-full max-w-[min(90vw,500px)] max-h-[90vh] overflow-y-auto custom-scrollbar-thin"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">
                Select Key
              </h3>
              <button
                onClick={() => setShowCircleOfFifths(false)}
                className="p-1 text-[#707070] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Circle of Fifths */}
            <CircleOfFifths
              selectedKey={formData.key}
              onKeySelect={key => {
                setFormData({ ...formData, key })
                setShowCircleOfFifths(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Delete Confirmation Dialog
interface DeleteConfirmationDialogProps {
  song: Song
  onConfirm: () => void
  onCancel: () => void
}

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  song,
  onConfirm,
  onCancel,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#D7263D]/10 flex items-center justify-center flex-shrink-0">
            <Trash2 size={20} className="text-[#D7263D]" />
          </div>
          <h3 className="text-lg font-semibold text-white">Delete Song?</h3>
        </div>

        <p className="text-sm text-[#a0a0a0] mb-6">
          Are you sure you want to delete{' '}
          <strong className="text-white">"{song.title}"</strong> by{' '}
          {song.artist}? This action cannot be undone.
        </p>

        {song.nextShow && (
          <div className="p-3 bg-[#f17827ff]/10 border border-[#f17827ff]/20 rounded-lg mb-6">
            <p className="text-xs text-[#f17827ff]">
              This song is scheduled for <strong>{song.nextShow.name}</strong>.
              It will be removed from that show.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-[#2a2a2a] text-white text-sm font-medium rounded-lg hover:bg-[#3a3a3a] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-[#D7263D] text-white text-sm font-medium rounded-lg hover:bg-[#b51f33] transition-colors"
            data-testid="confirm-delete-song-button"
          >
            Delete Song
          </button>
        </div>
      </div>
    </div>
  )
}

// Add to Setlist Menu
interface AddToSetlistMenuProps {
  song: Song
  onClose: () => void
}

const AddToSetlistMenu: React.FC<AddToSetlistMenuProps> = ({
  song,
  onClose,
}) => {
  const { showToast } = useToast()

  // Mock setlists
  const mockSetlists = [
    { id: '1', name: 'Toys 4 Tots', songCount: 15, hasSong: false },
    { id: '2', name: "New Year's Eve Bash", songCount: 18, hasSong: true },
    { id: '3', name: 'Summer Festival', songCount: 12, hasSong: false },
  ]

  const handleAddToSetlist = (setlistName: string) => {
    showToast(`Added "${song.title}" to ${setlistName}`, 'success')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
          <h3 className="text-lg font-semibold text-white">Add to Setlist</h3>
          <button
            onClick={onClose}
            className="p-1 text-[#707070] hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Setlist List */}
        <div className="p-2">
          {mockSetlists.map(setlist => (
            <button
              key={setlist.id}
              onClick={() => handleAddToSetlist(setlist.name)}
              className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-[#252525] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center">
                  <ListPlus size={20} className="text-[#a0a0a0]" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">
                    {setlist.name}
                  </div>
                  <div className="text-[#a0a0a0] text-xs">
                    {setlist.songCount} songs
                  </div>
                </div>
              </div>
              {setlist.hasSong && (
                <div className="text-[#f17827ff] text-xs">Already added</div>
              )}
            </button>
          ))}
        </div>

        {/* Create New Setlist */}
        <div className="p-4 border-t border-[#2a2a2a]">
          <button
            onClick={() =>
              showToast('Create new setlist functionality coming soon', 'info')
            }
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f17827ff] text-white text-sm font-medium rounded-lg hover:bg-[#d66620] transition-colors"
          >
            <Plus size={20} />
            <span>Create New Setlist</span>
          </button>
        </div>
      </div>
    </div>
  )
}
