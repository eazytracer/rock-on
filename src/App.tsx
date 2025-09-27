import React, { Suspense, lazy, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { BottomNavigation, defaultNavigationItems } from './components/common/BottomNavigation'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { Song } from './models/Song'
import { PracticeSession } from './models/PracticeSession'
import { Setlist } from './models/Setlist'
import { Member } from './models/Member'

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard').then(module => ({ default: module.Dashboard })))
const Songs = lazy(() => import('./pages/Songs/Songs').then(module => ({ default: module.Songs })))
const Sessions = lazy(() => import('./pages/Sessions/Sessions').then(module => ({ default: module.Sessions })))
const SetlistsPage = lazy(() => import('./pages/Setlists/Setlists').then(module => ({ default: module.Setlists })))

// Mock data for demonstration - in a real app this would come from the database/API
const mockSongs: Song[] = [
  {
    id: '1',
    title: 'Wonderwall',
    artist: 'Oasis',
    album: '(What\'s the Story) Morning Glory?',
    duration: 258,
    key: 'Em',
    bpm: 87,
    difficulty: 3,
    structure: [],
    chords: ['Em', 'G', 'D', 'C'],
    notes: 'Classic crowd pleaser',
    referenceLinks: [],
    tags: ['rock', 'cover', 'popular'],
    createdDate: new Date('2024-01-15'),
    lastPracticed: new Date('2024-09-20'),
    confidenceLevel: 4.2
  },
  {
    id: '2',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    duration: 356,
    key: 'D',
    bpm: 125,
    difficulty: 4,
    structure: [],
    chords: ['D', 'C', 'G', 'F'],
    notes: 'Work on the solo section',
    referenceLinks: [],
    tags: ['rock', 'cover', 'challenging'],
    createdDate: new Date('2024-01-20'),
    lastPracticed: new Date('2024-09-18'),
    confidenceLevel: 2.8
  },
  {
    id: '3',
    title: 'Hotel California',
    artist: 'Eagles',
    duration: 391,
    key: 'Bm',
    bpm: 75,
    difficulty: 4,
    structure: [],
    chords: ['Bm', 'F#', 'A', 'E', 'G', 'D', 'Em'],
    notes: 'Long song, need to practice transitions',
    referenceLinks: [],
    tags: ['rock', 'cover', 'epic'],
    createdDate: new Date('2024-02-01'),
    confidenceLevel: 3.5
  }
]

const mockMembers: Member[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@rockband.com',
    instruments: ['guitar', 'vocals'],
    primaryInstrument: 'guitar',
    role: 'admin',
    joinDate: new Date('2024-01-01'),
    isActive: true
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@rockband.com',
    instruments: ['bass'],
    primaryInstrument: 'bass',
    role: 'member',
    joinDate: new Date('2024-01-05'),
    isActive: true
  }
]

const mockSessions: PracticeSession[] = [
  {
    id: '1',
    bandId: 'band1',
    scheduledDate: new Date('2024-09-30T19:00:00'),
    duration: 120,
    location: 'Mike\'s Garage',
    type: 'rehearsal',
    status: 'scheduled',
    songs: [
      { songId: '1', timeSpent: 0, status: 'not-started', sectionsWorked: [], improvements: [], needsWork: [], memberRatings: [] },
      { songId: '2', timeSpent: 0, status: 'not-started', sectionsWorked: [], improvements: [], needsWork: [], memberRatings: [] }
    ],
    attendees: [
      { memberId: '1', confirmed: true, attended: false },
      { memberId: '2', confirmed: true, attended: false }
    ],
    notes: 'Focus on transitions between songs',
    objectives: ['Work on song transitions', 'Practice harmonies'],
    completedObjectives: []
  }
]

const mockSetlists: Setlist[] = [
  {
    id: '1',
    name: 'Coffee Shop Gig',
    bandId: 'band1',
    showDate: new Date('2024-10-15T20:00:00'),
    venue: 'Downtown Coffee',
    songs: [
      { songId: '1', order: 1 },
      { songId: '3', order: 2 },
      { songId: '2', order: 3 }
    ],
    totalDuration: 1005,
    notes: 'Acoustic setup, intimate venue',
    status: 'draft',
    createdDate: new Date('2024-09-25'),
    lastModified: new Date('2024-09-26')
  }
]

const AppContent: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [loading] = useState(false)

  const handleNavigation = (path: string) => {
    navigate(path)
  }

  // Mock handlers for demonstration
  const mockHandlers = {
    onAddSong: async (songData: any) => {
      console.log('Adding song:', songData)
      await new Promise(resolve => setTimeout(resolve, 1000))
    },
    onEditSong: async (songId: string, songData: any) => {
      console.log('Editing song:', songId, songData)
      await new Promise(resolve => setTimeout(resolve, 1000))
    },
    onDeleteSong: async (songId: string) => {
      console.log('Deleting song:', songId)
      await new Promise(resolve => setTimeout(resolve, 500))
    },
    onCreateSession: async (sessionData: any) => {
      console.log('Creating session:', sessionData)
      await new Promise(resolve => setTimeout(resolve, 1000))
    },
    onCreateSetlist: async (setlistData: any) => {
      console.log('Creating setlist:', setlistData)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="relative">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        }>
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  songs={mockSongs}
                  sessions={mockSessions}
                  setlists={mockSetlists}
                  members={mockMembers}
                  loading={loading}
                  onAddSong={() => navigate('/songs')}
                  onScheduleSession={() => navigate('/sessions')}
                  onCreateSetlist={() => navigate('/setlists')}
                  onStartPractice={() => navigate('/sessions')}
                  onViewSongs={() => navigate('/songs')}
                  onViewSessions={() => navigate('/sessions')}
                  onViewSetlists={() => navigate('/setlists')}
                />
              }
            />
            <Route
              path="/songs/*"
              element={
                <Songs
                  songs={mockSongs}
                  loading={loading}
                  onAddSong={mockHandlers.onAddSong}
                  onEditSong={mockHandlers.onEditSong}
                  onDeleteSong={mockHandlers.onDeleteSong}
                />
              }
            />
            <Route
              path="/sessions/*"
              element={
                <Sessions
                  sessions={mockSessions}
                  songs={mockSongs}
                  members={mockMembers}
                  loading={loading}
                  onCreateSession={mockHandlers.onCreateSession}
                />
              }
            />
            <Route
              path="/setlists/*"
              element={
                <SetlistsPage
                  setlists={mockSetlists}
                  songs={mockSongs}
                  loading={loading}
                  onCreateSetlist={mockHandlers.onCreateSetlist}
                />
              }
            />
          </Routes>
        </Suspense>
      </main>

      <BottomNavigation
        currentPath={location.pathname}
        onNavigate={handleNavigation}
        items={defaultNavigationItems}
      />
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App