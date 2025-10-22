import React, { Suspense, lazy, useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AuthGuard } from './components/auth/AuthGuard'
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
import { BandMembershipService } from './services/BandMembershipService'
import { db } from './services/database'
import { User } from './models/User'

// Lazy load pages for better performance
const Auth = lazy(() => import('./pages/Auth/Auth').then(module => ({ default: module.Auth })))
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard').then(module => ({ default: module.Dashboard })))
const Songs = lazy(() => import('./pages/Songs/Songs').then(module => ({ default: module.Songs })))
const Sessions = lazy(() => import('./pages/Sessions/Sessions').then(module => ({ default: module.Sessions })))
const SetlistsPage = lazy(() => import('./pages/Setlists/Setlists').then(module => ({ default: module.Setlists })))
const NewLayout = lazy(() => import('./pages/NewLayout/NewLayout').then(module => ({ default: module.NewLayout })))


const AppContent: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [songs, setSongs] = useState<Song[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [bandUsers, setBandUsers] = useState<User[]>([]) // Authenticated users in the band
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

        // Load actual authenticated users who are members of the current band
        // For now, we'll use 'band1' as the default band
        const bandId = 'band1'
        const bandMemberships = await BandMembershipService.getBandMembers(bandId)
        console.log('Band memberships loaded:', bandMemberships)

        // Get User data for each band member
        const userPromises = bandMemberships.map(membership =>
          db.users.get(membership.userId)
        )
        const usersData = await Promise.all(userPromises)
        console.log('User data loaded:', usersData)

        const validUsers = usersData.filter((u): u is User => u !== undefined)
        console.log('Valid users (for casting):', validUsers)

        setBandUsers(validUsers)
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
    onAddSong: async (songData: any) => {
      try {
        setLoading(true)

        // Context fields may already be set by the Songs page
        // Only set defaults if not provided
        const completeSongData = {
          ...songData,
          createdBy: songData.createdBy || user?.id || 'unknown',
          contextType: songData.contextType || 'band',
          contextId: songData.contextId || 'band1',
          visibility: songData.visibility || 'band_only'
        }
        await songService.add(completeSongData)
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
    onCreateSession: async (sessionData: any) => {
      try {
        setLoading(true)

        // Transform songIds into SessionSong objects
        const songs = (sessionData.songIds || []).map((songId: string) => ({
          songId,
          timeSpent: 0,
          status: 'not-started' as const,
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: []
        }))

        // Transform inviteeIds into SessionAttendee objects
        const attendees = (sessionData.inviteeIds || []).map((memberId: string) => ({
          memberId,
          confirmed: false,
          attended: false
        }))

        // Create the complete session data
        const completeSessionData = {
          bandId: sessionData.bandId || 'band1',
          scheduledDate: sessionData.scheduledDate,
          duration: sessionData.duration,
          location: sessionData.location,
          type: sessionData.type,
          status: 'scheduled' as const,
          songs,
          attendees,
          notes: sessionData.notes,
          objectives: sessionData.objectives || [],
          completedObjectives: []
        }

        await sessionService.add(completeSessionData)
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
    },
    onEditSession: async (sessionId: string, sessionData: any) => {
      try {
        setLoading(true)
        await sessionService.update(sessionId, sessionData)
        const updatedSessions = await sessionService.getAll()
        setSessions(updatedSessions)
      } catch (error) {
        console.error('Error editing session:', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    onDeleteSession: async (sessionId: string) => {
      try {
        setLoading(true)
        await sessionService.delete(sessionId)
        const updatedSessions = await sessionService.getAll()
        setSessions(updatedSessions)
      } catch (error) {
        console.error('Error deleting session:', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    onStartSession: async (sessionId: string) => {
      try {
        // This will be called when a user clicks "Start Session"
        // For now, we just navigate to the session view
        // The Sessions component handles the actual session start logic
        console.log('Starting session:', sessionId)
      } catch (error) {
        console.error('Error starting session:', error)
        throw error
      }
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      }>
        <Routes>
          {/* Auth route - public */}
          <Route path="/auth" element={<Auth />} />

          {/* Protected routes */}
          <Route
            path="/*"
            element={
              <AuthGuard>
                <div className={location.pathname === '/new-layout' ? '' : 'pb-20 pt-16'}>
                  {location.pathname !== '/new-layout' && (
                    <Header onLogoClick={() => navigate('/')} />
                  )}
                  <main className="relative">
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
                            members={bandUsers.map(u => ({
                              id: u.id,
                              name: u.name,
                              email: u.email,
                              instruments: [],
                              primaryInstrument: 'Not specified',
                              role: 'member' as const,
                              joinDate: u.createdDate,
                              isActive: true
                            }))}
                            loading={loading}
                            onCreateSession={handlers.onCreateSession}
                            onEditSession={handlers.onEditSession}
                            onDeleteSession={handlers.onDeleteSession}
                            onStartSession={handlers.onStartSession}
                          />
                        }
                      />
                      <Route
                        path="/setlists/*"
                        element={
                          <SetlistsPage
                            setlists={setlists}
                            songs={songs}
                            bandMembers={bandUsers.map(u => ({ userId: u.id, name: u.name }))}
                            bandId="band1"
                            loading={loading}
                            onCreateSetlist={handlers.onCreateSetlist}
                            onEditSetlist={handlers.onEditSetlist}
                            onDeleteSetlist={handlers.onDeleteSetlist}
                            onDuplicateSetlist={handlers.onDuplicateSetlist}
                          />
                        }
                      />
                      <Route
                        path="/new-layout"
                        element={<NewLayout />}
                      />
                    </Routes>
                  </main>

                  {location.pathname !== '/new-layout' && (
                    <BottomNavigation
                      currentPath={location.pathname}
                      onNavigate={handleNavigation}
                      items={defaultNavigationItems}
                    />
                  )}
                </div>
              </AuthGuard>
            }
          />
        </Routes>
      </Suspense>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

export default App