import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { TouchButton } from '../common/TouchButton'

interface LoginFormProps {
  onSignUpClick: () => void
  onSuccess?: () => void
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSignUpClick, onSuccess }) => {
  const { signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showMockUsers, setShowMockUsers] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }

    const result = await signIn({ email, password })
    if (result.error) {
      setError(result.error)
    } else {
      onSuccess?.()
    }
  }

  const handleMockUserLogin = async (mockEmail: string) => {
    setEmail(mockEmail)
    setPassword('password123')
    setError(null)

    const result = await signIn({ email: mockEmail, password: 'password123' })
    if (result.error) {
      setError(result.error)
    } else {
      onSuccess?.()
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-steel-gray mb-2">Welcome Back</h1>
        <p className="text-steel-gray/70">Sign in to continue to Rock On</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-amp-red/10 border border-amp-red rounded-lg">
          <p className="text-amp-red text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-steel-gray mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-steel-gray/30 bg-smoke-white text-steel-gray focus:outline-none focus:ring-2 focus:ring-energy-orange focus:border-transparent"
            placeholder="you@example.com"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-steel-gray mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-steel-gray/30 bg-smoke-white text-steel-gray focus:outline-none focus:ring-2 focus:ring-energy-orange focus:border-transparent"
            placeholder="••••••••"
            disabled={loading}
          />
        </div>

        <TouchButton type="submit" fullWidth loading={loading} className="mt-6">
          Sign In
        </TouchButton>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setShowMockUsers(!showMockUsers)}
          className="text-sm text-energy-orange hover:text-energy-orange/80"
        >
          {showMockUsers ? 'Hide' : 'Show'} Mock Users for Testing
        </button>
      </div>

      {showMockUsers && (
        <div className="mt-4 p-4 bg-steel-gray/5 rounded-lg">
          <p className="text-xs text-steel-gray/70 mb-3">Quick login with test users:</p>
          <div className="space-y-2">
            <TouchButton
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => handleMockUserLogin('alice@example.com')}
              disabled={loading}
            >
              Alice (Guitar, Vocals)
            </TouchButton>
            <TouchButton
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => handleMockUserLogin('bob@example.com')}
              disabled={loading}
            >
              Bob (Bass, Keyboards)
            </TouchButton>
            <TouchButton
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => handleMockUserLogin('charlie@example.com')}
              disabled={loading}
            >
              Charlie (Drums, Percussion)
            </TouchButton>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-steel-gray/70 text-sm">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSignUpClick}
            className="text-energy-orange hover:text-energy-orange/80 font-medium"
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  )
}
