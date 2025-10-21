import React, { Suspense, lazy, useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { BottomNavigation, defaultNavigationItems } from './components/common/BottomNavigation'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { Header } from './components/common/Header'
import { Song } from './models/Song'
import { PracticeSession } from './models/PracticeSession'
import { Setlist } from './models/Setlist'
import { Member } from './models/Member'
import { SetlistSong } from './types'
import { seedDatabase } from './database/seedData'
import { songService, memberService, sessionService, setlistService } from './database/services'

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard').then(module => ({ default: module.Dashboard })))
const Songs = lazy(() => import('./pages/Songs/Songs').then(module => ({ default: module.Songs })))
const Sessions = lazy(() => import('./pages/Sessions/Sessions').then(module => ({ default: module.Sessions })))
const SetlistsPage = lazy(() => import('./pages/Setlists/Setlists').then(module => ({ default: module.Setlists })))


const AppContent: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [songs, setSongs] = useState<Song[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [sessions, setSessions] = useState<PracticeSession[]>([])
  const [setlists, setSetlists] = useState<Setlist[]>([])

  // Initialize database and load data
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true)

        // Seed the database with initial data if it's empty
        await seedDatabase()

        // Load data from database
        const [songsData, membersData, sessionsData, setlistsData] = await Promise.all([
          songService.getAll(),
          memberService.getAll(),
          sessionService.getAll(),
          setlistService.getAll()
        ])

        setSongs(songsData)
        setMembers(membersData)
        setSessions(sessionsData)
        setSetlists(setlistsData)
      } catch (error) {
        console.error('Error initializing app:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeApp()
  }, [])

  const handleNavigation = (path: string) => {
    navigate(path)
  }

  // Database handlers
  const handlers = {
    onAddSong: async (songData: Omit<Song, 'id' | 'createdDate' | 'lastPracticed' | 'confidenceLevel'>) => {
      try {
        setLoading(true)
        await songService.add(songData)
        const updatedSongs = await songService.getAll()
        setSongs(updatedSongs)
      } catch (error) {
        console.error('Error adding song:', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    onEditSong: async (songId: string, songData: Partial<Song>) => {
      try {
        setLoading(true)
        await songService.update(songId, songData)
        const updatedSongs = await songService.getAll()
        setSongs(updatedSongs)
      } catch (error) {
        console.error('Error editing song:', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    onDeleteSong: async (songId: string) => {
      try {
        setLoading(true)
        await songService.delete(songId)
        const updatedSongs = await songService.getAll()
        setSongs(updatedSongs)
      } catch (error) {
        console.error('Error deleting song:', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    onCreateSession: async (sessionData: Omit<PracticeSession, 'id'>) => {
      try {
        setLoading(true)
        await sessionService.add(sessionData)
        const updatedSessions = await sessionService.getAll()
        setSessions(updatedSessions)
      } catch (error) {
        console.error('Error creating session:', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    onCreateSetlist: async (setlistData: {
      name: string
      songs: SetlistSong[]
      showDate?: Date
      venue?: string
      notes?: string
    }) => {
      try {
        setLoading(true)
        const fullSetlistData = {
          ...setlistData,
          bandId: 'band1', // Default band ID
          status: 'draft' as const,
          totalDuration: setlistData.songs.reduce((total, song) => {
            const foundSong = songs.find(s => s.id === song.songId)
            return total + (foundSong?.duration || 0)
          }, 0)
        }
        await setlistService.add(fullSetlistData)
        const updatedSetlists = await setlistService.getAll()
        setSetlists(updatedSetlists)
      } catch (error) {
        console.error('Error creating setlist:', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    onEditSetlist: async (setlistId: string, setlistData: Partial<Setlist>) => {
      try {
        setLoading(true)
        // If songs are being updated, recalculate total duration
        if (setlistData.songs) {
          setlistData.totalDuration = setlistData.songs.reduce((total, song) => {
            const foundSong = songs.find(s => s.id === song.songId)
            return total + (foundSong?.duration || 0)
          }, 0)
        }
        await setlistService.update(setlistId, setlistData)
        const updatedSetlists = await setlistService.getAll()
        setSetlists(updatedSetlists)
      } catch (error) {
        console.error('Error editing setlist:', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    onDeleteSetlist: async (setlistId: string) => {
      try {
        setLoading(true)
        await setlistService.delete(setlistId)
        const updatedSetlists = await setlistService.getAll()
        setSetlists(updatedSetlists)
      } catch (error) {
        console.error('Error deleting setlist:', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    onDuplicateSetlist: async (setlistId: string) => {
      try {
        setLoading(true)
        const originalSetlist = await setlistService.getById(setlistId)
        if (!originalSetlist) {
          throw new Error('Setlist not found')
        }
        const duplicateData = {
          ...originalSetlist,
          name: `${originalSetlist.name} (Copy)`,
          bandId: originalSetlist.bandId,
          status: 'draft' as const
        }
        // Remove fields that will be auto-generated
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, createdDate, lastModified, ...setlistDataToAdd } = duplicateData
        await setlistService.add(setlistDataToAdd)
        const updatedSetlists = await setlistService.getAll()
        setSetlists(updatedSetlists)
      } catch (error) {
        console.error('Error duplicating setlist:', error)
        throw error
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-20 pt-16">
      <Header onLogoClick={() => navigate('/')} />
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
                  songs={songs}
                  sessions={sessions}
                  setlists={setlists}
                  members={members}
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
                  songs={songs}
                  loading={loading}
                  onAddSong={handlers.onAddSong}
                  onEditSong={handlers.onEditSong}
                  onDeleteSong={handlers.onDeleteSong}
                />
              }
            />
            <Route
              path="/sessions/*"
              element={
                <Sessions
                  sessions={sessions}
                  songs={songs}
                  members={members}
                  loading={loading}
                  onCreateSession={handlers.onCreateSession}
                />
              }
            />
            <Route
              path="/setlists/*"
              element={
                <SetlistsPage
                  setlists={setlists}
                  songs={songs}
                  loading={loading}
                  onCreateSetlist={handlers.onCreateSetlist}
                  onEditSetlist={handlers.onEditSetlist}
                  onDeleteSetlist={handlers.onDeleteSetlist}
                  onDuplicateSetlist={handlers.onDuplicateSetlist}
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