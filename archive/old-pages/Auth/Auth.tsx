import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LoginForm } from '../../components/auth/LoginForm'
import { SignupForm } from '../../components/auth/SignupForm'
import { BandCreationForm } from '../../components/auth/BandCreationForm'
import { JoinBandForm } from '../../components/auth/JoinBandForm'
import { InitialSetupService } from '../../services/setup/InitialSetupService'

type AuthView = 'login' | 'signup' | 'createBand' | 'joinBand'

export const Auth: React.FC = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const [currentView, setCurrentView] = useState<AuthView>('login')
  const [needsBandSetup, setNeedsBandSetup] = useState(false)

  useEffect(() => {
    const checkSetup = async () => {
      if (isAuthenticated && user) {
        const hasSetup = await InitialSetupService.hasCompletedSetup(user.id)
        if (!hasSetup) {
          setNeedsBandSetup(true)
        } else {
          navigate('/')
        }
      }
    }

    checkSetup()
  }, [isAuthenticated, user, navigate])

  const handleLoginSuccess = () => {
    // Will be handled by useEffect
  }

  const handleSignupSuccess = () => {
    // After signup, show band creation/join options
    setNeedsBandSetup(true)
  }

  const handleBandCreated = (bandId: string) => {
    console.log('Band created:', bandId)
    navigate('/')
  }

  const handleBandJoined = (bandId: string) => {
    console.log('Joined band:', bandId)
    navigate('/')
  }

  const handleSkipBandSetup = async () => {
    if (user) {
      // Create a default band
      await InitialSetupService.createDefaultBand(user.id, user.name)
      navigate('/')
    }
  }

  if (needsBandSetup) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-steel-gray mb-4">
              Welcome to Rock On, {user?.name}!
            </h1>
            <p className="text-steel-gray/70 text-lg">
              Let's get you set up. Create a new band or join an existing one.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div
              className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all ${
                currentView === 'createBand' ? 'ring-2 ring-energy-orange' : ''
              }`}
            >
              {currentView === 'createBand' ? (
                <BandCreationForm
                  onSuccess={handleBandCreated}
                  onCancel={() => setCurrentView('login')}
                />
              ) : (
                <div className="p-6 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-energy-orange/10 rounded-full mb-4">
                    <svg
                      className="w-8 h-8 text-energy-orange"
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
                  </div>
                  <h3 className="text-xl font-bold text-steel-gray mb-2">Create a Band</h3>
                  <p className="text-steel-gray/70 text-sm mb-6">
                    Start fresh with your own band and invite members
                  </p>
                  <button
                    onClick={() => setCurrentView('createBand')}
                    className="w-full px-6 py-3 bg-energy-orange text-white rounded-lg hover:bg-energy-orange/90 transition-colors"
                  >
                    Create Band
                  </button>
                </div>
              )}
            </div>

            <div
              className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all ${
                currentView === 'joinBand' ? 'ring-2 ring-energy-orange' : ''
              }`}
            >
              {currentView === 'joinBand' ? (
                <JoinBandForm
                  onSuccess={handleBandJoined}
                  onCancel={() => setCurrentView('login')}
                />
              ) : (
                <div className="p-6 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-energy-orange/10 rounded-full mb-4">
                    <svg
                      className="w-8 h-8 text-energy-orange"
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
                  </div>
                  <h3 className="text-xl font-bold text-steel-gray mb-2">Join a Band</h3>
                  <p className="text-steel-gray/70 text-sm mb-6">
                    Enter an invite code to join your bandmates
                  </p>
                  <button
                    onClick={() => setCurrentView('joinBand')}
                    className="w-full px-6 py-3 bg-energy-orange text-white rounded-lg hover:bg-energy-orange/90 transition-colors"
                  >
                    Join Band
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={handleSkipBandSetup}
              className="text-steel-gray/70 hover:text-steel-gray text-sm"
            >
              Skip for now (create a default band)
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg">
        {currentView === 'login' ? (
          <LoginForm
            onSignUpClick={() => setCurrentView('signup')}
            onSuccess={handleLoginSuccess}
          />
        ) : (
          <SignupForm
            onSignInClick={() => setCurrentView('login')}
            onSuccess={handleSignupSuccess}
          />
        )}
      </div>
    </div>
  )
}
