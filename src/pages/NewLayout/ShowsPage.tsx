import React, { useState } from 'react'
import { ModernLayout } from '../../components/layout/ModernLayout'
import { TimePicker } from '../../components/common/TimePicker'
import {
  Plus,
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  Music,
  Phone,
  MoreVertical,
  X,
  ChevronDown,
  Filter as FilterIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Circle,
  Edit2,
  Trash2,
  User,
  FileText,
  ChevronRight,
  Guitar,
  Activity
} from 'lucide-react'

// Types
interface ShowContact {
  name: string
  role?: string
  phone?: string
  email?: string
}

interface Song {
  id: string
  title: string
  artist: string
  duration: string
  durationSeconds: number
  key: string
  tuning: string
  bpm: string
}

interface SetlistSong extends Song {
  position: number
}

interface Setlist {
  id: string
  name: string
  songs: SetlistSong[]
  totalDuration: string
  songCount: number
}

interface Show {
  id: string
  bandId: string
  name: string
  date: Date
  time: string
  venue?: string
  address?: string
  setlistId?: string
  setlistName?: string
  loadInTime?: string
  soundcheckTime?: string
  setLength?: number
  paymentAmount?: number
  paymentStatus?: 'unpaid' | 'partial' | 'paid'
  contacts?: ShowContact[]
  notes?: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  createdDate: Date
  lastModified: Date
}

type FilterType = 'all' | 'upcoming' | 'past' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

// Mock Songs Library
const MOCK_SONGS: Song[] = [
  {
    id: 's1',
    title: 'All Star',
    artist: 'Smash Mouth',
    duration: '3:14',
    durationSeconds: 194,
    key: 'F#',
    tuning: 'Standard',
    bpm: '104'
  },
  {
    id: 's2',
    title: 'Man in the Box',
    artist: 'Alice In Chains',
    duration: '4:47',
    durationSeconds: 287,
    key: 'Ebm',
    tuning: 'Half-step down',
    bpm: '108'
  },
  {
    id: 's3',
    title: 'No Rain',
    artist: 'Blind Melon',
    duration: '3:33',
    durationSeconds: 213,
    key: 'E',
    tuning: 'Standard',
    bpm: '150'
  },
  {
    id: 's4',
    title: 'Monkey Wrench',
    artist: 'Foo Fighters',
    duration: '3:51',
    durationSeconds: 231,
    key: 'B',
    tuning: 'Drop D',
    bpm: '175'
  },
  {
    id: 's5',
    title: 'Everlong',
    artist: 'Foo Fighters',
    duration: '4:10',
    durationSeconds: 250,
    key: 'D',
    tuning: 'Drop D',
    bpm: '158'
  },
  {
    id: 's6',
    title: 'Black Hole Sun',
    artist: 'Soundgarden',
    duration: '5:18',
    durationSeconds: 318,
    key: 'G',
    tuning: 'Drop D',
    bpm: '104'
  },
  {
    id: 's7',
    title: 'Come As You Are',
    artist: 'Nirvana',
    duration: '3:39',
    durationSeconds: 219,
    key: 'Em',
    tuning: 'Standard',
    bpm: '120'
  },
  {
    id: 's8',
    title: 'Plush',
    artist: 'Stone Temple Pilots',
    duration: '5:13',
    durationSeconds: 313,
    key: 'G',
    tuning: 'Half-step down',
    bpm: '78'
  }
]

// Mock setlists with songs
const mockSetlistsWithSongs: Record<string, Setlist> = {
  'setlist1': {
    id: 'setlist1',
    name: 'Holiday Classics',
    songCount: 6,
    totalDuration: '25 min',
    songs: [
      { ...MOCK_SONGS[0], position: 1 },
      { ...MOCK_SONGS[1], position: 2 },
      { ...MOCK_SONGS[2], position: 3 },
      { ...MOCK_SONGS[3], position: 4 },
      { ...MOCK_SONGS[4], position: 5 },
      { ...MOCK_SONGS[5], position: 6 }
    ]
  },
  'setlist2': {
    id: 'setlist2',
    name: 'High Energy Set',
    songCount: 7,
    totalDuration: '30 min',
    songs: [
      { ...MOCK_SONGS[3], position: 1 },
      { ...MOCK_SONGS[4], position: 2 },
      { ...MOCK_SONGS[0], position: 3 },
      { ...MOCK_SONGS[2], position: 4 },
      { ...MOCK_SONGS[6], position: 5 },
      { ...MOCK_SONGS[1], position: 6 },
      { ...MOCK_SONGS[5], position: 7 }
    ]
  },
  'setlist3': {
    id: 'setlist3',
    name: 'Acoustic Favorites',
    songCount: 5,
    totalDuration: '20 min',
    songs: [
      { ...MOCK_SONGS[7], position: 1 },
      { ...MOCK_SONGS[2], position: 2 },
      { ...MOCK_SONGS[5], position: 3 },
      { ...MOCK_SONGS[6], position: 4 },
      { ...MOCK_SONGS[0], position: 5 }
    ]
  },
  'setlist4': {
    id: 'setlist4',
    name: 'Dark & Heavy',
    songCount: 6,
    totalDuration: '27 min',
    songs: [
      { ...MOCK_SONGS[1], position: 1 },
      { ...MOCK_SONGS[5], position: 2 },
      { ...MOCK_SONGS[6], position: 3 },
      { ...MOCK_SONGS[7], position: 4 },
      { ...MOCK_SONGS[3], position: 5 },
      { ...MOCK_SONGS[4], position: 6 }
    ]
  }
}

// Mock data
const mockShows: Show[] = [
  {
    id: '1',
    bandId: 'band1',
    name: 'Toys 4 Tots Benefit',
    date: new Date('2025-12-08T20:00:00'),
    time: '8:00 PM',
    venue: "The Whiskey Room",
    address: "123 Main St, Downtown, CA 90210",
    setlistId: 'setlist1',
    setlistName: 'Holiday Classics',
    loadInTime: '6:00 PM',
    soundcheckTime: '7:00 PM',
    setLength: 90,
    paymentAmount: 1500,
    paymentStatus: 'paid',
    contacts: [
      { name: 'Sarah Johnson', role: 'Venue Manager', phone: '555-0123', email: 'sarah@whiskeyroom.com' },
      { name: 'Mike Chen', role: 'Sound Engineer', phone: '555-0124' }
    ],
    notes: 'Charity event - bring extra merch. Load in through back entrance.',
    status: 'confirmed',
    createdDate: new Date('2025-10-15'),
    lastModified: new Date('2025-10-20')
  },
  {
    id: '2',
    bandId: 'band1',
    name: 'New Years Eve Bash',
    date: new Date('2025-12-31T21:00:00'),
    time: '9:00 PM',
    venue: "The Roxy Theatre",
    address: "9009 Sunset Blvd, West Hollywood, CA 90069",
    setlistId: 'setlist2',
    setlistName: 'High Energy Set',
    loadInTime: '7:00 PM',
    soundcheckTime: '8:00 PM',
    setLength: 120,
    paymentAmount: 3000,
    paymentStatus: 'partial',
    contacts: [
      { name: 'David Lee', role: 'Promoter', phone: '555-0125', email: 'david@roxytheatre.com' }
    ],
    notes: 'Two sets - one before midnight, one after. Confetti cannons at midnight.',
    status: 'confirmed',
    createdDate: new Date('2025-09-10'),
    lastModified: new Date('2025-10-18')
  },
  {
    id: '3',
    bandId: 'band1',
    name: 'Saturday Night Live',
    date: new Date('2025-11-15T22:00:00'),
    time: '10:00 PM',
    venue: "Blue Moon Bar",
    address: "456 Ocean Ave, Santa Monica, CA 90401",
    loadInTime: '8:30 PM',
    soundcheckTime: '9:15 PM',
    setLength: 60,
    paymentAmount: 800,
    paymentStatus: 'unpaid',
    contacts: [
      { name: 'Jessica Martinez', role: 'Bar Owner', phone: '555-0126', email: 'jessica@bluemoonbar.com' }
    ],
    status: 'scheduled',
    createdDate: new Date('2025-10-01'),
    lastModified: new Date('2025-10-01')
  },
  {
    id: '4',
    bandId: 'band1',
    name: 'Spring Festival',
    date: new Date('2026-03-21T15:00:00'),
    time: '3:00 PM',
    venue: "City Park Amphitheater",
    address: "789 Park Lane, Los Angeles, CA 90012",
    setlistId: 'setlist3',
    setlistName: 'Acoustic Favorites',
    setLength: 75,
    paymentAmount: 2000,
    paymentStatus: 'unpaid',
    contacts: [
      { name: 'Robert Kim', role: 'Festival Coordinator', phone: '555-0127', email: 'robert@springfest.org' }
    ],
    notes: 'Outdoor venue - bring covers for gear. Rain date is March 22nd.',
    status: 'scheduled',
    createdDate: new Date('2025-10-05'),
    lastModified: new Date('2025-10-12')
  },
  {
    id: '5',
    bandId: 'band1',
    name: 'Private Corporate Event',
    date: new Date('2026-02-14T19:00:00'),
    time: '7:00 PM',
    venue: "Grand Ballroom Hotel",
    address: "321 Luxury Dr, Beverly Hills, CA 90210",
    loadInTime: '5:00 PM',
    soundcheckTime: '6:00 PM',
    setLength: 90,
    paymentAmount: 5000,
    paymentStatus: 'partial',
    contacts: [
      { name: 'Amanda Foster', role: 'Event Planner', phone: '555-0128', email: 'amanda@luxevents.com' }
    ],
    notes: 'Black tie event. Client requests mostly classic rock and Motown.',
    status: 'confirmed',
    createdDate: new Date('2025-10-08'),
    lastModified: new Date('2025-10-19')
  },
  {
    id: '6',
    bandId: 'band1',
    name: 'Halloween Spooktacular',
    date: new Date('2025-10-31T20:00:00'),
    time: '8:00 PM',
    venue: "The Viper Room",
    address: "8852 Sunset Blvd, West Hollywood, CA 90069",
    setlistId: 'setlist4',
    setlistName: 'Dark & Heavy',
    loadInTime: '6:30 PM',
    soundcheckTime: '7:30 PM',
    setLength: 120,
    paymentAmount: 1800,
    paymentStatus: 'paid',
    contacts: [
      { name: 'Chris Anderson', role: 'Venue Manager', phone: '555-0129', email: 'chris@viperroom.com' }
    ],
    notes: 'Costume contest during break. Bring fog machine if available.',
    status: 'completed',
    createdDate: new Date('2025-08-15'),
    lastModified: new Date('2025-11-01')
  },
  {
    id: '7',
    bandId: 'band1',
    name: 'Summer Kick-Off Party',
    date: new Date('2025-06-21T18:00:00'),
    time: '6:00 PM',
    venue: "Beach Bar & Grill",
    address: "555 Pacific Coast Hwy, Malibu, CA 90265",
    setLength: 60,
    paymentAmount: 1200,
    paymentStatus: 'paid',
    contacts: [
      { name: 'Tom Wilson', role: 'Owner', phone: '555-0130', email: 'tom@beachbar.com' }
    ],
    status: 'completed',
    createdDate: new Date('2025-04-10'),
    lastModified: new Date('2025-06-22')
  },
  {
    id: '8',
    bandId: 'band1',
    name: 'Memorial Day BBQ',
    date: new Date('2025-05-26T14:00:00'),
    time: '2:00 PM',
    venue: "Veterans Park",
    address: "100 Memorial Ave, Pasadena, CA 91101",
    setLength: 90,
    paymentAmount: 0,
    paymentStatus: 'unpaid',
    notes: 'Free community event - no payment. Great exposure!',
    status: 'completed',
    createdDate: new Date('2025-03-20'),
    lastModified: new Date('2025-05-27')
  },
  {
    id: '9',
    bandId: 'band1',
    name: 'Battle of the Bands',
    date: new Date('2025-04-15T19:00:00'),
    time: '7:00 PM',
    venue: "Rock Central",
    address: "777 Music Row, Hollywood, CA 90028",
    setLength: 30,
    paymentAmount: 500,
    paymentStatus: 'paid',
    status: 'completed',
    createdDate: new Date('2025-03-01'),
    lastModified: new Date('2025-04-16')
  },
  {
    id: '10',
    bandId: 'band1',
    name: "St. Patrick's Day Pub Crawl",
    date: new Date('2025-03-17T16:00:00'),
    time: '4:00 PM',
    venue: "Irish Pub Downtown",
    address: "234 Green St, Los Angeles, CA 90013",
    setLength: 45,
    paymentAmount: 600,
    paymentStatus: 'paid',
    status: 'completed',
    createdDate: new Date('2025-02-01'),
    lastModified: new Date('2025-03-18')
  },
  {
    id: '11',
    bandId: 'band1',
    name: 'Jazz & Blues Night',
    date: new Date('2025-01-20T20:00:00'),
    time: '8:00 PM',
    venue: "The Blue Note",
    address: "888 Jazz Blvd, Los Angeles, CA 90015",
    setLength: 75,
    paymentAmount: 1000,
    paymentStatus: 'paid',
    status: 'cancelled',
    notes: 'Cancelled due to venue flooding.',
    createdDate: new Date('2024-12-10'),
    lastModified: new Date('2025-01-15')
  }
]

// Mock setlists for dropdown
const mockSetlists = [
  { id: 'setlist1', name: 'Holiday Classics', songCount: 15 },
  { id: 'setlist2', name: 'High Energy Set', songCount: 18 },
  { id: 'setlist3', name: 'Acoustic Favorites', songCount: 12 },
  { id: 'setlist4', name: 'Dark & Heavy', songCount: 14 },
  { id: 'setlist5', name: 'Summer Vibes', songCount: 16 }
]

export const ShowsPage: React.FC = () => {
  const [shows, setShows] = useState<Show[]>(mockShows)
  const [filter, setFilter] = useState<FilterType>('upcoming')
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)
  const [showToDelete, setShowToDelete] = useState<Show | null>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Helper functions
  const getFilteredShows = (): Show[] => {
    const now = new Date()

    switch (filter) {
      case 'upcoming':
        return shows.filter(show => show.date > now && show.status !== 'cancelled')
      case 'past':
        return shows.filter(show => show.date <= now || show.status === 'completed')
      case 'scheduled':
        return shows.filter(show => show.status === 'scheduled')
      case 'confirmed':
        return shows.filter(show => show.status === 'confirmed')
      case 'completed':
        return shows.filter(show => show.status === 'completed')
      case 'cancelled':
        return shows.filter(show => show.status === 'cancelled')
      default:
        return shows
    }
  }

  const getNextShow = (): Show | null => {
    const now = new Date()
    const upcomingShows = shows
      .filter(show => show.date > now && show.status !== 'cancelled')
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    return upcomingShows[0] || null
  }

  const getDaysUntilShow = (date: Date): string => {
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    if (days < 0) return `${Math.abs(days)} days ago`
    return `In ${days} days`
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateBadge = (date: Date) => {
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const day = date.getDate()
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })

    return { month, day, weekday }
  }

  const handleDeleteShow = (show: Show) => {
    setShows(shows.filter(s => s.id !== show.id))
    setShowToDelete(null)
  }

  const handleEditShow = (show: Show) => {
    setSelectedShow(show)
    setIsScheduleModalOpen(true)
  }

  const nextShow = getNextShow()
  const filteredShows = getFilteredShows()

  return (
    <ModernLayout bandName="iPod Shuffle" userEmail="eric@example.com">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Shows</h1>
            <ChevronDown size={20} className="text-[#a0a0a0]" />
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
              >
                <FilterIcon size={20} />
                <span className="capitalize">{filter}</span>
              </button>

              {isFilterOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1">
                  {(['all', 'upcoming', 'past', 'scheduled', 'confirmed', 'completed', 'cancelled'] as FilterType[]).map((filterOption) => (
                    <button
                      key={filterOption}
                      onClick={() => {
                        setFilter(filterOption)
                        setIsFilterOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors capitalize ${
                        filter === filterOption
                          ? 'bg-[#f17827ff]/10 text-[#f17827ff]'
                          : 'text-white hover:bg-[#252525]'
                      }`}
                    >
                      {filterOption}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setSelectedShow(null)
                setIsScheduleModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
            >
              <Plus size={20} />
              <span>Schedule Show</span>
            </button>
          </div>
        </div>
      </div>

      {/* Next Show Preview Card */}
      {nextShow && filter === 'upcoming' && (
        <div className="mb-6 p-6 bg-gradient-to-br from-[#f17827ff]/10 to-transparent border-2 border-[#f17827ff]/30 rounded-xl">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs font-semibold text-[#f17827ff] uppercase tracking-wider mb-1">
                Next Show
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{nextShow.name}</h2>
              <div className="text-lg text-[#f17827ff] font-semibold">
                {getDaysUntilShow(nextShow.date)}
              </div>
            </div>
            <ShowStatusBadge status={nextShow.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-white">
              <Calendar size={20} className="text-[#f17827ff]" />
              <div>
                <div className="text-sm font-medium">{formatDate(nextShow.date)}</div>
                <div className="text-xs text-[#a0a0a0]">{nextShow.time}</div>
              </div>
            </div>

            {nextShow.venue && (
              <div className="flex items-center gap-3 text-white">
                <MapPin size={20} className="text-[#f17827ff]" />
                <div>
                  <div className="text-sm font-medium">{nextShow.venue}</div>
                  {nextShow.address && <div className="text-xs text-[#a0a0a0]">{nextShow.address}</div>}
                </div>
              </div>
            )}

            {nextShow.setlistName && (
              <div className="flex items-center gap-3 text-white">
                <Music size={20} className="text-[#f17827ff]" />
                <div>
                  <div className="text-sm font-medium">{nextShow.setlistName}</div>
                  <div className="text-xs text-[#a0a0a0]">Setlist</div>
                </div>
              </div>
            )}

            {nextShow.paymentAmount !== undefined && (
              <div className="flex items-center gap-3 text-white">
                <DollarSign size={20} className="text-[#f17827ff]" />
                <div>
                  <div className="text-sm font-medium">${nextShow.paymentAmount.toLocaleString()}</div>
                  {nextShow.paymentStatus && (
                    <div className="text-xs text-[#a0a0a0] capitalize">{nextShow.paymentStatus}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shows List */}
      {filteredShows.length === 0 ? (
        <EmptyState onSchedule={() => setIsScheduleModalOpen(true)} />
      ) : (
        <div className="space-y-3">
          {filteredShows
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .map((show) => (
              <ShowCard
                key={show.id}
                show={show}
                onEdit={() => handleEditShow(show)}
                onDelete={() => setShowToDelete(show)}
                formatDateBadge={formatDateBadge}
                getDaysUntilShow={getDaysUntilShow}
              />
            ))}
        </div>
      )}

      {/* Schedule/Edit Show Modal */}
      {isScheduleModalOpen && (
        <ScheduleShowModal
          show={selectedShow}
          onClose={() => {
            setIsScheduleModalOpen(false)
            setSelectedShow(null)
          }}
          onSave={(showData) => {
            if (selectedShow) {
              // Edit existing show
              setShows(shows.map(s => s.id === selectedShow.id ? { ...s, ...showData, lastModified: new Date() } : s))
            } else {
              // Create new show
              const newShow: Show = {
                ...showData,
                id: `show-${Date.now()}`,
                bandId: 'band1',
                createdDate: new Date(),
                lastModified: new Date()
              }
              setShows([...shows, newShow])
            }
            setIsScheduleModalOpen(false)
            setSelectedShow(null)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showToDelete && (
        <DeleteConfirmationModal
          show={showToDelete}
          onConfirm={() => handleDeleteShow(showToDelete)}
          onCancel={() => setShowToDelete(null)}
        />
      )}
    </ModernLayout>
  )
}

// Show Card Component
const ShowCard: React.FC<{
  show: Show
  onEdit: () => void
  onDelete: () => void
  formatDateBadge: (date: Date) => { month: string; day: number; weekday: string }
  getDaysUntilShow: (date: Date) => string
}> = ({ show, onEdit, onDelete, formatDateBadge, getDaysUntilShow }) => {
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const dateBadge = formatDateBadge(show.date)
  const paymentConfig = show.paymentAmount ? getPaymentStatusConfig(show.paymentStatus) : null

  const isUpcoming = show.date > new Date() && show.status !== 'cancelled'

  // Get the setlist for this show
  const setlist = show.setlistId ? mockSetlistsWithSongs[show.setlistId] : null

  return (
    <div className={`bg-[#1a1a1a] rounded-xl p-5 border transition-all ${
      show.status === 'cancelled' ? 'border-[#2a2a2a] opacity-60' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
    }`}>
      <div className="flex items-start gap-4">
        {/* Date Badge */}
        <div className={`flex-shrink-0 w-16 h-16 rounded-lg flex flex-col items-center justify-center border-2 ${
          isUpcoming ? 'bg-[#f17827ff]/10 border-[#f17827ff]' : 'bg-[#2a2a2a] border-[#3a3a3a]'
        }`}>
          <div className={`text-xs font-semibold uppercase ${isUpcoming ? 'text-[#f17827ff]' : 'text-[#707070]'}`}>
            {dateBadge.month}
          </div>
          <div className={`text-2xl font-bold ${isUpcoming ? 'text-white' : 'text-[#a0a0a0]'}`}>
            {dateBadge.day}
          </div>
          <div className={`text-xs ${isUpcoming ? 'text-[#a0a0a0]' : 'text-[#707070]'}`}>
            {dateBadge.weekday}
          </div>
        </div>

        {/* Show Info */}
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className={`text-lg font-bold mb-1 ${
                show.status === 'cancelled' ? 'line-through text-[#707070]' : 'text-white'
              }`}>
                {show.name}
              </h3>
              {isUpcoming && (
                <div className="text-sm text-[#f17827ff] font-medium">
                  {getDaysUntilShow(show.date)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ShowStatusBadge status={show.status} />

              {/* Actions Menu */}
              <div className="relative">
                <button
                  onClick={() => setIsActionsOpen(!isActionsOpen)}
                  className="p-1.5 rounded-lg hover:bg-[#252525] transition-colors text-[#a0a0a0]"
                >
                  <MoreVertical size={18} />
                </button>

                {isActionsOpen && (
                  <div className="absolute top-full right-0 mt-2 w-40 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1">
                    <button
                      onClick={() => {
                        onEdit()
                        setIsActionsOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#252525] transition-colors flex items-center gap-2"
                    >
                      <Edit2 size={16} />
                      Edit Show
                    </button>
                    <button
                      onClick={() => {
                        onDelete()
                        setIsActionsOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-[#a0a0a0]">
              <Clock size={16} />
              <span>{show.time}</span>
            </div>

            {show.venue && (
              <div className="flex items-center gap-2 text-[#a0a0a0]">
                <MapPin size={16} />
                <span className="truncate">{show.venue}</span>
              </div>
            )}

            {show.setlistName && (
              <div className="flex items-center gap-2 text-[#a0a0a0]">
                <Music size={16} />
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-[#f17827ff] hover:underline cursor-pointer flex items-center gap-1"
                >
                  {show.setlistName}
                  <ChevronRight
                    size={14}
                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>
              </div>
            )}

            {show.paymentAmount !== undefined && paymentConfig && (
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-[#a0a0a0]" />
                <span className="text-[#a0a0a0]">${show.paymentAmount.toLocaleString()}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${paymentConfig.color}`}>
                  {paymentConfig.label}
                </span>
              </div>
            )}

            {show.contacts && show.contacts.length > 0 && (
              <div className="flex items-center gap-2 text-[#a0a0a0]">
                <User size={16} />
                <span className="truncate">{show.contacts[0].name}</span>
                {show.contacts[0].phone && (
                  <a href={`tel:${show.contacts[0].phone}`} className="text-[#f17827ff] hover:underline">
                    <Phone size={14} />
                  </a>
                )}
              </div>
            )}

            {show.setLength && (
              <div className="flex items-center gap-2 text-[#a0a0a0]">
                <Clock size={16} />
                <span>{show.setLength} min set</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {show.notes && (
            <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
              <div className="flex items-start gap-2 text-sm text-[#a0a0a0]">
                <FileText size={16} className="mt-0.5 flex-shrink-0" />
                <p className="line-clamp-2">{show.notes}</p>
              </div>
            </div>
          )}

          {/* Expanded Setlist View */}
          {isExpanded && setlist && (
            <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-white">Setlist Songs</h4>
                <div className="text-xs text-[#a0a0a0]">
                  {setlist.songCount} songs • {setlist.totalDuration}
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar-thin">
                {setlist.songs.map((song) => (
                  <SetlistSongMiniCard key={song.id} song={song} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Mini Song Card Component for Expanded Setlist
const SetlistSongMiniCard: React.FC<{ song: SetlistSong }> = ({ song }) => {
  return (
    <div className="flex items-center gap-3 p-3 bg-[#121212] rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors">
      {/* Position Number */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-white text-sm font-semibold">
        {song.position}
      </div>

      {/* Song Info */}
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium text-sm truncate">{song.title}</div>
        <div className="text-[#a0a0a0] text-xs truncate">{song.artist}</div>
      </div>

      {/* Song Metadata */}
      <div className="flex items-center gap-3 text-xs text-[#a0a0a0]">
        <div className="flex items-center gap-1">
          <Clock size={14} />
          <span>{song.duration}</span>
        </div>
        <div className="flex items-center gap-1">
          <Music size={14} />
          <span>{song.key}</span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          <Guitar size={14} />
          <span className="px-2 py-0.5 bg-[#2a2a2a] rounded text-xs">
            {song.tuning}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          <Activity size={14} />
          <span>{song.bpm} bpm</span>
        </div>
      </div>
    </div>
  )
}

// Status Badge Component
const ShowStatusBadge: React.FC<{ status: Show['status'] }> = ({ status }) => {
  const config = getStatusConfig(status)
  const Icon = config.icon

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon size={14} />
      <span>{config.label}</span>
    </div>
  )
}

// Schedule Show Modal Component
const ScheduleShowModal: React.FC<{
  show: Show | null
  onClose: () => void
  onSave: (show: Omit<Show, 'id' | 'bandId' | 'createdDate' | 'lastModified'>) => void
}> = ({ show, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: show?.name || '',
    date: show?.date ? show.date.toISOString().split('T')[0] : '',
    time: show?.time || '',
    venue: show?.venue || '',
    address: show?.address || '',
    setlistId: show?.setlistId || '',
    loadInTime: show?.loadInTime || '',
    soundcheckTime: show?.soundcheckTime || '',
    setLength: show?.setLength?.toString() || '',
    paymentAmount: show?.paymentAmount?.toString() || '',
    paymentStatus: show?.paymentStatus || 'unpaid',
    notes: show?.notes || '',
    status: show?.status || 'scheduled'
  })

  const [contacts, setContacts] = useState<ShowContact[]>(show?.contacts || [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Create forked setlist name if setlist is selected
    let forkedSetlistName: string | undefined
    if (formData.setlistId) {
      const originalSetlist = mockSetlists.find(s => s.id === formData.setlistId)
      if (originalSetlist) {
        forkedSetlistName = `${originalSetlist.name} - ${formData.name}`
      }
    }

    const showData: Omit<Show, 'id' | 'bandId' | 'createdDate' | 'lastModified'> = {
      name: formData.name,
      date: new Date(formData.date + 'T' + (formData.time ? formData.time.replace(' PM', '').replace(' AM', '') : '00:00')),
      time: formData.time,
      venue: formData.venue || undefined,
      address: formData.address || undefined,
      setlistId: formData.setlistId || undefined,
      setlistName: forkedSetlistName,
      loadInTime: formData.loadInTime || undefined,
      soundcheckTime: formData.soundcheckTime || undefined,
      setLength: formData.setLength ? parseInt(formData.setLength) : undefined,
      paymentAmount: formData.paymentAmount ? parseFloat(formData.paymentAmount) : undefined,
      paymentStatus: formData.paymentAmount ? (formData.paymentStatus as 'unpaid' | 'partial' | 'paid') : undefined,
      contacts: contacts.length > 0 ? contacts : undefined,
      notes: formData.notes || undefined,
      status: formData.status as Show['status']
    }

    onSave(showData)
  }

  const addContact = () => {
    setContacts([...contacts, { name: '', role: '', phone: '', email: '' }])
  }

  const updateContact = (index: number, field: keyof ShowContact, value: string) => {
    const updated = [...contacts]
    updated[index] = { ...updated[index], [field]: value }
    setContacts(updated)
  }

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#2a2a2a] p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {show ? 'Edit Show' : 'Schedule Show'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#252525] transition-colors text-[#a0a0a0]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">Basic Info</h3>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Show/Event Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                placeholder="e.g., Toys 4 Tots Benefit"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Time <span className="text-red-500">*</span>
                </label>
                <TimePicker
                  value={formData.time}
                  onChange={(time) => setFormData({ ...formData, time })}
                  placeholder="Select time"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Show['status'] })}
                className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
              >
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Venue Section */}
          <div className="space-y-4 pt-6 border-t border-[#2a2a2a]">
            <h3 className="text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">Venue</h3>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Venue Name</label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                placeholder="e.g., The Whiskey Room"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                placeholder="Full address"
              />
            </div>
          </div>

          {/* Schedule Section */}
          <div className="space-y-4 pt-6 border-t border-[#2a2a2a]">
            <h3 className="text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">Schedule</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Load-in Time</label>
                <TimePicker
                  value={formData.loadInTime}
                  onChange={(time) => setFormData({ ...formData, loadInTime: time })}
                  placeholder="Select load-in time"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Soundcheck Time</label>
                <TimePicker
                  value={formData.soundcheckTime}
                  onChange={(time) => setFormData({ ...formData, soundcheckTime: time })}
                  placeholder="Select soundcheck time"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Set Length (min)</label>
                <input
                  type="number"
                  value={formData.setLength}
                  onChange={(e) => setFormData({ ...formData, setLength: e.target.value })}
                  className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  placeholder="90"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Setlist</label>
              <select
                value={formData.setlistId}
                onChange={(e) => setFormData({ ...formData, setlistId: e.target.value })}
                className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
              >
                <option value="">No setlist assigned</option>
                {mockSetlists.map((setlist) => (
                  <option key={setlist.id} value={setlist.id}>
                    {setlist.name} ({setlist.songCount} songs)
                  </option>
                ))}
              </select>
              {formData.setlistId && (
                <div className="mt-2 p-3 bg-[#f17827ff]/10 border border-[#f17827ff]/30 rounded-lg">
                  <p className="text-xs text-[#f17827ff] flex items-center gap-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>This will create a copy of the setlist for this show. Changes to the show's setlist won't affect the original.</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Section */}
          <div className="space-y-4 pt-6 border-t border-[#2a2a2a]">
            <h3 className="text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">Payment</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Amount ($)</label>
                <input
                  type="number"
                  value={formData.paymentAmount}
                  onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                  className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  placeholder="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Payment Status</label>
                <select
                  value={formData.paymentStatus}
                  onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as 'unpaid' | 'partial' | 'paid' })}
                  className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  disabled={!formData.paymentAmount}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contacts Section */}
          <div className="space-y-4 pt-6 border-t border-[#2a2a2a]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">Contacts</h3>
              <button
                type="button"
                onClick={addContact}
                className="flex items-center gap-1 text-sm text-[#f17827ff] hover:text-[#d66920] transition-colors"
              >
                <Plus size={16} />
                Add Contact
              </button>
            </div>

            {contacts.map((contact, index) => (
              <div key={index} className="p-4 bg-[#121212] border border-[#2a2a2a] rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[#a0a0a0] uppercase">Contact {index + 1}</div>
                  <button
                    type="button"
                    onClick={() => removeContact(index)}
                    className="text-red-500 hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => updateContact(index, 'name', e.target.value)}
                    className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    value={contact.role || ''}
                    onChange={(e) => updateContact(index, 'role', e.target.value)}
                    className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none"
                    placeholder="Role (e.g., Venue Manager)"
                  />
                  <input
                    type="tel"
                    value={contact.phone || ''}
                    onChange={(e) => updateContact(index, 'phone', e.target.value)}
                    className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none"
                    placeholder="Phone"
                  />
                  <input
                    type="email"
                    value={contact.email || ''}
                    onChange={(e) => updateContact(index, 'email', e.target.value)}
                    className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none"
                    placeholder="Email"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Notes Section */}
          <div className="space-y-4 pt-6 border-t border-[#2a2a2a]">
            <h3 className="text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">Notes</h3>

            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 resize-none"
              placeholder="Any additional details, special requirements, or reminders..."
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#2a2a2a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
            >
              {show ? 'Save Changes' : 'Schedule Show'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Delete Confirmation Modal
const DeleteConfirmationModal: React.FC<{
  show: Show
  onConfirm: () => void
  onCancel: () => void
}> = ({ show, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-md p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 rounded-full bg-red-500/10">
            <AlertCircle size={24} className="text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">Delete Show?</h3>
            <p className="text-sm text-[#a0a0a0]">
              Are you sure you want to delete "<span className="text-white font-medium">{show.name}</span>"?
              This action cannot be undone.
            </p>
            {show.setlistName && (
              <p className="text-xs text-[#707070] mt-2">
                Note: The associated setlist "{show.setlistName}" will not be deleted.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
          >
            Delete Show
          </button>
        </div>
      </div>
    </div>
  )
}

// Empty State Component
const EmptyState: React.FC<{ onSchedule: () => void }> = ({ onSchedule }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-[#f17827ff]/10 flex items-center justify-center mb-4">
        <Calendar size={32} className="text-[#f17827ff]" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">No shows scheduled</h3>
      <p className="text-[#a0a0a0] text-sm mb-6 text-center max-w-md">
        Schedule your first show to get started and keep track of your upcoming performances
      </p>
      <button
        onClick={onSchedule}
        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#f17827ff] text-white font-medium hover:bg-[#d66920] transition-colors"
      >
        <Plus size={20} />
        Schedule Show
      </button>
    </div>
  )
}

// Helper function (outside component to avoid re-definition)
function getStatusConfig(status: Show['status']) {
  switch (status) {
    case 'scheduled':
      return {
        icon: Circle,
        color: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
        label: 'Scheduled'
      }
    case 'confirmed':
      return {
        icon: CheckCircle2,
        color: 'text-[#f17827ff] bg-[#f17827ff]/10 border-[#f17827ff]/20',
        label: 'Confirmed'
      }
    case 'completed':
      return {
        icon: CheckCircle2,
        color: 'text-green-500 bg-green-500/10 border-green-500/20',
        label: 'Completed'
      }
    case 'cancelled':
      return {
        icon: XCircle,
        color: 'text-red-500 bg-red-500/10 border-red-500/20',
        label: 'Cancelled'
      }
  }
}

function getPaymentStatusConfig(status?: 'unpaid' | 'partial' | 'paid') {
  switch (status) {
    case 'paid':
      return { color: 'text-green-500 bg-green-500/10 border-green-500/20', label: 'Paid' }
    case 'partial':
      return { color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20', label: 'Partial' }
    case 'unpaid':
      return { color: 'text-red-500 bg-red-500/10 border-red-500/20', label: 'Unpaid' }
    default:
      return null
  }
}
