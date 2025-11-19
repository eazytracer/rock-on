import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { TouchButton } from '../common/TouchButton'

interface SignupFormProps {
  onSignInClick: () => void
  onSuccess?: () => void
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSignInClick, onSuccess }) => {
  const { signUp, loading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    const result = await signUp({ name, email, password })
    if (result.error) {
      setError(result.error)
    } else {
      onSuccess?.()
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-steel-gray mb-2">Create Account</h1>
        <p className="text-steel-gray/70">Join Rock On and start managing your band</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-amp-red/10 border border-amp-red rounded-lg">
          <p className="text-amp-red text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-steel-gray mb-2">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-steel-gray/30 bg-smoke-white text-steel-gray focus:outline-none focus:ring-2 focus:ring-energy-orange focus:border-transparent"
            placeholder="John Doe"
            disabled={loading}
          />
        </div>

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
          <p className="mt-1 text-xs text-steel-gray/60">Minimum 6 characters</p>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-steel-gray mb-2"
          >
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-steel-gray/30 bg-smoke-white text-steel-gray focus:outline-none focus:ring-2 focus:ring-energy-orange focus:border-transparent"
            placeholder="••••••••"
            disabled={loading}
          />
        </div>

        <TouchButton type="submit" fullWidth loading={loading} className="mt-6">
          Create Account
        </TouchButton>
      </form>

      <div className="mt-8 text-center">
        <p className="text-steel-gray/70 text-sm">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSignInClick}
            className="text-energy-orange hover:text-energy-orange/80 font-medium"
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  )
}
