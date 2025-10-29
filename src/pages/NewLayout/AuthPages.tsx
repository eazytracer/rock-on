import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
  Users,
  UserPlus,
  Ticket,
  LogOut,
  Settings,
  Check,
  X,
  AlertCircle
} from 'lucide-react'

// ============================================================================
// DATABASE IMPORTS - Added for Phase 2 Database Integration
// ============================================================================
// PHASE 2 CHANGES SUMMARY:
// 1. Sign Up Form: Creates user in db.users and db.userProfiles, stores userId in localStorage
// 2. Log In Form: Queries db.users by email, updates lastLogin, checks for bands
// 3. Get Started - Create Band: Uses useCreateBand hook, creates invite code, stores bandId
// 4. Get Started - Join Band: Queries db.inviteCodes, validates code, creates membership
// 5. Create Band Modal: Same as Get Started create flow for modals
// 6. Join Band Modal: Same as Get Started join flow for modals
// All operations include proper error handling with try-catch blocks and error toasts
// ============================================================================
import { db } from '../../services/database'
import { useCreateBand } from '../../hooks/useBands'
import { useAuth } from '../../contexts/AuthContext'
// Band type not currently used but may be needed for future features

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface UserData {
  id: string
  email: string
  displayName: string
  password: string
}

interface BandDisplay {
  id: string
  name: string
  memberCount: number
  role: 'Owner' | 'Member'
  inviteCode: string
}

interface FormErrors {
  [key: string]: string
}

// ============================================================================
// MOCK DATA
// ============================================================================

// Mock data for testing - not currently used in production
const _MOCK_BANDS: BandDisplay[] = [
  {
    id: 'band-1',
    name: 'iPod Shuffle',
    memberCount: 6,
    role: 'Owner',
    inviteCode: 'ROCK2025'
  },
  {
    id: 'band-2',
    name: 'The Electric Dreams',
    memberCount: 4,
    role: 'Member',
    inviteCode: 'DREAM99'
  },
  {
    id: 'band-3',
    name: 'Midnight Riders',
    memberCount: 5,
    role: 'Owner',
    inviteCode: 'RIDE42'
  }
]

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

const validatePassword = (password: string): boolean => {
  return password.length >= 8
}

// ============================================================================
// REUSABLE UI COMPONENTS
// ============================================================================

interface GoogleButtonProps {
  onClick: () => void
  variant: 'signin' | 'signup'
}

const GoogleButton: React.FC<GoogleButtonProps> = ({ onClick, variant }) => {
  const text = variant === 'signin' ? 'Sign in with Google' : 'Sign up with Google'

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-12 bg-white border border-[#2a2a2a] rounded-lg text-[#1a1a1a] font-medium text-base hover:bg-[#f5f5f5] transition-colors flex items-center justify-center gap-3"
    >
      {/* Google Logo SVG */}
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
        <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z" fill="#34A853"/>
        <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.141 1.064 4.49L4.405 11.9z" fill="#FBBC05"/>
        <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.192 5.736 7.396 3.977 10 3.977z" fill="#EA4335"/>
      </svg>
      {text}
    </button>
  )
}

interface DividerProps {
  text?: string
}

const Divider: React.FC<DividerProps> = ({ text = 'or' }) => {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-[#2a2a2a]" />
      <span className="text-[#707070] text-sm">{text}</span>
      <div className="flex-1 h-px bg-[#2a2a2a]" />
    </div>
  )
}

interface InputFieldProps {
  label: string
  type: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  icon?: React.ReactNode
  showPasswordToggle?: boolean
  onTogglePassword?: () => void
  showPassword?: boolean
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  type,
  value,
  onChange,
  error,
  placeholder,
  icon,
  showPasswordToggle,
  onTogglePassword,
  showPassword
}) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-white mb-2">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]">
            {icon}
          </div>
        )}
        <input
          type={showPasswordToggle && showPassword ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full h-11 ${icon ? 'pl-11' : 'pl-4'} ${showPasswordToggle ? 'pr-11' : 'pr-4'}
            bg-[#1a1a1a] border rounded-lg text-white text-sm
            placeholder-[#707070] transition-colors
            focus:outline-none focus:ring-2
            ${error
              ? 'border-[#D7263D] focus:border-[#D7263D] focus:ring-[#D7263D]/20'
              : 'border-[#2a2a2a] focus:border-[#f17827ff] focus:ring-[#f17827ff]/20'
            }
          `}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707070] hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-[#D7263D] flex items-center gap-1">
          <AlertCircle size={14} />
          {error}
        </p>
      )}
    </div>
  )
}

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'danger'
  fullWidth?: boolean
  disabled?: boolean
  loading?: boolean
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  loading = false
}) => {
  const baseStyles = 'h-11 px-6 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2'

  const variants = {
    primary: 'bg-[#f17827ff] text-white hover:bg-[#d96a1f] disabled:bg-[#f17827ff]/50 disabled:cursor-not-allowed',
    secondary: 'bg-transparent border border-[#2a2a2a] text-white hover:bg-[#1f1f1f] disabled:opacity-50 disabled:cursor-not-allowed',
    danger: 'bg-[#D7263D] text-white hover:bg-[#b51f31] disabled:bg-[#D7263D]/50 disabled:cursor-not-allowed'
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''}`}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  )
}

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const colors = {
    success: 'bg-[#4ade80] border-[#4ade80]/20',
    error: 'bg-[#D7263D] border-[#D7263D]/20',
    info: 'bg-[#3b82f6] border-[#3b82f6]/20'
  }

  return (
    <div className={`fixed top-6 right-6 ${colors[type]} text-white px-4 py-3 rounded-lg border shadow-lg z-50 animate-slide-in-right`}>
      <div className="flex items-center gap-2">
        {type === 'success' && <Check size={18} />}
        {type === 'error' && <X size={18} />}
        {type === 'info' && <AlertCircle size={18} />}
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  )
}

// ============================================================================
// AUTHENTICATION PAGES
// ============================================================================

interface SignUpPageProps {
  onSwitchToLogin: () => void
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onSwitchToLogin }) => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!validateEmail(email)) {
      newErrors.email = 'Invalid email format'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (!validatePassword(password)) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!displayName) {
      newErrors.displayName = 'Display name is required'
    } else if (displayName.length < 2) {
      newErrors.displayName = 'Display name must be at least 2 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      setLoading(true)

      try {
        // PHASE 2 DATABASE INTEGRATION: Create user in database
        const userId = crypto.randomUUID()

        // Create user in db.users table
        await db.users.add({
          id: userId,
          email,
          name: displayName, // Using displayName as the user's name
          authProvider: 'mock',
          createdDate: new Date(),
          lastLogin: new Date()
        })

        // Create user profile in db.userProfiles table
        await db.userProfiles.add({
          id: crypto.randomUUID(),
          userId,
          displayName,
          instruments: [],
          createdDate: new Date(),
          updatedDate: new Date()
        })

        // Store authenticated user ID in localStorage
        localStorage.setItem('currentUserId', userId)

        setLoading(false)
        // Navigate to get started - user needs to create/join a band
        navigate('/get-started')
      } catch (err) {
        console.error('Sign up error:', err)
        setErrors({ email: 'Failed to create account. Please try again.' })
        setLoading(false)
      }
    }
  }

  const handleGoogleSignUp = () => {
    console.log('Google auth not implemented yet')
  }

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#f17827ff] to-[#d96a1f] rounded-xl mb-4">
            <span className="text-white font-bold text-2xl">R</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-[#a0a0a0] text-sm">Join Rock-On and start managing your band</p>
        </div>

        {/* Form Card */}
        <div className="bg-[#1a1a1a] rounded-xl p-8 border border-[#2a2a2a]">
          {/* Google Sign Up Button */}
          <GoogleButton onClick={handleGoogleSignUp} variant="signup" />

          <Divider />

          <form onSubmit={handleSubmit}>
            <InputField
              label="Display Name"
              type="text"
              value={displayName}
              onChange={setDisplayName}
              error={errors.displayName}
              placeholder="Your name"
              icon={<User size={18} />}
            />

            <InputField
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              error={errors.email}
              placeholder="you@example.com"
              icon={<Mail size={18} />}
            />

            <InputField
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              placeholder="At least 8 characters"
              icon={<Lock size={18} />}
              showPasswordToggle
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
            />

            <InputField
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={errors.confirmPassword}
              placeholder="Re-enter your password"
              icon={<Lock size={18} />}
              showPasswordToggle
              showPassword={showConfirmPassword}
              onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
            />

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={onSwitchToLogin}
              className="text-sm text-[#f17827ff] hover:text-[#d96a1f] transition-colors"
            >
              Already have an account? <span className="font-semibold">Log in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface LoginPageProps {
  onSuccess: () => void
  onSwitchToSignup: () => void
}

const LoginPage: React.FC<LoginPageProps> = ({ onSuccess: _onSuccess, onSwitchToSignup }) => {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [showMockUsers, setShowMockUsers] = useState(false)

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!email) {
      newErrors.email = 'Email is required'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      setLoading(true)

      try {
        // PHASE 2 DATABASE INTEGRATION: Query database for user
        const user = await db.users
          .where('email')
          .equals(email.toLowerCase())
          .first()

        if (user) {
          // User exists - set localStorage and update lastLogin
          localStorage.setItem('currentUserId', user.id)

          // Update user's lastLogin timestamp
          await db.users.update(user.id, {
            lastLogin: new Date()
          })

          // Check if user has any bands
          const memberships = await db.bandMemberships
            .where('userId')
            .equals(user.id)
            .toArray()

          if (memberships.length > 0) {
            // User has bands - set currentBandId to first band and navigate to app
            localStorage.setItem('currentBandId', memberships[0].bandId)
            setLoading(false)
            navigate('/songs')
          } else {
            // User has no bands - navigate to get started
            setLoading(false)
            navigate('/get-started')
          }
        } else {
          setLoading(false)
          setErrors({ password: 'Invalid email or password' })
        }
      } catch (err) {
        console.error('Login error:', err)
        setErrors({ password: 'Login failed. Please try again.' })
        setLoading(false)
      }
    }
  }

  const handleGoogleSignIn = () => {
    console.log('Google auth not implemented yet')
  }

  const handleMockUserLogin = async (mockEmail: string) => {
    // Use REAL Supabase auth instead of mock localStorage-only auth
    // All test users have password "test123"
    setEmail(mockEmail)
    setPassword('test123')
    setErrors({})
    setLoading(true)

    try {
      // Sign in with Supabase (this will trigger all the auth syncing)
      const { error } = await signIn({
        email: mockEmail,
        password: 'test123'
      })

      if (error) {
        setLoading(false)
        setErrors({ password: error })
        return
      }

      // Success! Auth context will handle the rest
      // Wait a moment for sync to complete
      await new Promise(resolve => setTimeout(resolve, 1000))

      setLoading(false)
      navigate('/songs')
    } catch (err) {
      console.error('Mock login error:', err)
      setErrors({ password: 'Login failed. Please try again.' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#f17827ff] to-[#d96a1f] rounded-xl mb-4">
            <span className="text-white font-bold text-2xl">R</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-[#a0a0a0] text-sm">Log in to continue to Rock-On</p>
        </div>

        {/* Form Card */}
        <div className="bg-[#1a1a1a] rounded-xl p-8 border border-[#2a2a2a]">
          {/* Google Sign In Button */}
          <GoogleButton onClick={handleGoogleSignIn} variant="signin" />

          <Divider />

          <form onSubmit={handleSubmit}>
            <InputField
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              error={errors.email}
              placeholder="you@example.com"
              icon={<Mail size={18} />}
            />

            <InputField
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              placeholder="Enter your password"
              icon={<Lock size={18} />}
              showPasswordToggle
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
            />

            <div className="mb-6">
              <button
                type="button"
                className="text-sm text-[#707070] hover:text-[#a0a0a0] transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Log In
            </Button>
          </form>

          {/* Quick Signon for Testing */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setShowMockUsers(!showMockUsers)}
              className="text-sm text-[#f17827ff] hover:text-[#d96a1f] transition-colors"
            >
              {showMockUsers ? 'Hide' : 'Show'} Mock Users for Testing
            </button>
          </div>

          {showMockUsers && (
            <div className="mt-4 p-4 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
              <p className="text-xs text-[#707070] mb-3">Quick login with test users:</p>
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => handleMockUserLogin('eric@ipodshuffle.com')}
                  disabled={loading}
                >
                  Eric (Guitar, Vocals)
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => handleMockUserLogin('mike@ipodshuffle.com')}
                  disabled={loading}
                >
                  Mike (Bass, Harmonica, Vocals)
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => handleMockUserLogin('sarah@ipodshuffle.com')}
                  disabled={loading}
                >
                  Sarah (Drums, Percussion)
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={onSwitchToSignup}
              className="text-sm text-[#f17827ff] hover:text-[#d96a1f] transition-colors"
            >
              Don't have an account? <span className="font-semibold">Sign up</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface GetStartedPageProps {
  // No props needed - will use navigate
}

const GetStartedPage: React.FC<GetStartedPageProps> = () => {
  const navigate = useNavigate()
  const [bandName, setBandName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // PHASE 2 DATABASE INTEGRATION: Use the createBand hook
  const { createBand } = useCreateBand()

  const handleCreateBand = async () => {
    if (!bandName) {
      setErrors({ bandName: 'Band name is required' })
      return
    }
    if (bandName.length < 2) {
      setErrors({ bandName: 'Band name must be at least 2 characters' })
      return
    }

    setLoading(true)

    try {
      // PHASE 2 DATABASE INTEGRATION: Create band with real database operations
      const currentUserId = localStorage.getItem('currentUserId')
      if (!currentUserId) {
        throw new Error('No user logged in')
      }

      // Create band using the hook (this creates band + owner membership)
      const bandId = await createBand({ name: bandName }, currentUserId)

      if (!bandId) {
        throw new Error('Failed to create band')
      }

      // Generate initial invite code with format 'ROCK' + random 4 digits
      const randomDigits = Math.floor(1000 + Math.random() * 9000) // Generates 4-digit number
      const generatedCode = 'ROCK' + randomDigits

      await db.inviteCodes.add({
        id: crypto.randomUUID(),
        bandId,
        code: generatedCode,
        createdBy: currentUserId,
        currentUses: 0,
        maxUses: 999, // Allow many uses
        createdDate: new Date(),
        isActive: true
      })

      // Store bandId in localStorage as currentBandId
      localStorage.setItem('currentBandId', bandId)

      setLoading(false)
      setToast({
        message: `Band created! Share this invite code: ${generatedCode}`,
        type: 'success'
      })
      setTimeout(() => {
        navigate('/songs')
      }, 2000)
    } catch (err) {
      console.error('Error creating band:', err)
      setErrors({ bandName: 'Failed to create band. Please try again.' })
      setLoading(false)
    }
  }

  const handleJoinBand = async () => {
    if (!inviteCode) {
      setErrors({ inviteCode: 'Invite code is required' })
      return
    }

    setLoading(true)

    try {
      // PHASE 2 DATABASE INTEGRATION: Query database for invite code
      const currentUserId = localStorage.getItem('currentUserId')
      if (!currentUserId) {
        throw new Error('No user logged in')
      }

      // Find the invite code in database
      const foundCode = await db.inviteCodes
        .where('code')
        .equals(inviteCode.toUpperCase())
        .first()

      if (foundCode) {
        // Check if code has reached max uses
        if (foundCode.maxUses && foundCode.currentUses >= foundCode.maxUses) {
          setLoading(false)
          setErrors({ inviteCode: 'This invite code has reached its maximum uses' })
          return
        }

        // Check if code is expired
        if (foundCode.expiresAt && new Date() > foundCode.expiresAt) {
          setLoading(false)
          setErrors({ inviteCode: 'This invite code has expired' })
          return
        }

        const bandId = foundCode.bandId

        // Check if user is already a member
        const existingMembership = await db.bandMemberships
          .where('userId')
          .equals(currentUserId)
          .and(m => m.bandId === bandId)
          .first()

        if (existingMembership) {
          setLoading(false)
          setErrors({ inviteCode: 'You are already a member of this band' })
          return
        }

        // Create membership with role='member'
        await db.bandMemberships.add({
          id: crypto.randomUUID(),
          userId: currentUserId,
          bandId,
          role: 'member',
          joinedDate: new Date(),
          status: 'active',
          permissions: ['member']
        })

        // Increment currentUses on the invite code
        await db.inviteCodes.update(foundCode.id, {
          currentUses: foundCode.currentUses + 1
        })

        // Store bandId in localStorage as currentBandId
        localStorage.setItem('currentBandId', bandId)

        // Get band name for toast message
        const band = await db.bands.get(bandId)

        setLoading(false)
        setToast({
          message: `You joined ${band?.name || 'the band'}!`,
          type: 'success'
        })
        setTimeout(() => {
          navigate('/songs')
        }, 2000)
      } else {
        setLoading(false)
        setErrors({ inviteCode: 'Invalid invite code' })
      }
    } catch (err) {
      console.error('Error joining band:', err)
      setErrors({ inviteCode: 'Failed to join band. Please try again.' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">Get Started with Rock-On</h1>
          <p className="text-[#a0a0a0] text-base">Create your first band or join an existing one</p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Create Band Card */}
          <div className="bg-[#1a1a1a] rounded-xl p-8 border border-[#2a2a2a]">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-[#f17827ff]/10 rounded-full mb-4">
                <Users size={24} className="text-[#f17827ff]" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Create Your First Band</h2>
              <p className="text-[#a0a0a0] text-sm">Start your own band and invite members</p>
            </div>

            <InputField
              label="Band Name"
              type="text"
              value={bandName}
              onChange={(value) => {
                setBandName(value)
                setErrors({})
              }}
              error={errors.bandName}
              placeholder="Enter band name"
            />

            <Button
              variant="primary"
              fullWidth
              onClick={handleCreateBand}
              loading={loading}
            >
              Create Band
            </Button>
          </div>

          {/* Join Band Card */}
          <div className="bg-[#1a1a1a] rounded-xl p-8 border border-[#2a2a2a]">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-[#f17827ff]/10 rounded-full mb-4">
                <Ticket size={24} className="text-[#f17827ff]" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Join an Existing Band</h2>
              <p className="text-[#a0a0a0] text-sm">Enter an invite code from your bandmates</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase())
                  setErrors({})
                }}
                placeholder="ROCK2025"
                className={`
                  w-full h-11 px-4 bg-[#1a1a1a] border rounded-lg text-white text-sm
                  font-mono text-center tracking-wider uppercase
                  placeholder-[#707070] transition-colors
                  focus:outline-none focus:ring-2
                  ${errors.inviteCode
                    ? 'border-[#D7263D] focus:border-[#D7263D] focus:ring-[#D7263D]/20'
                    : 'border-[#2a2a2a] focus:border-[#f17827ff] focus:ring-[#f17827ff]/20'
                  }
                `}
              />
              {errors.inviteCode && (
                <p className="mt-1 text-sm text-[#D7263D] flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors.inviteCode}
                </p>
              )}
            </div>

            <Button
              variant="primary"
              fullWidth
              onClick={handleJoinBand}
              loading={loading}
            >
              Join Band
            </Button>
          </div>
        </div>

        {/* Helper Text */}
        <div className="mt-8 text-center">
          <p className="text-[#707070] text-sm">
            Try using invite code <span className="font-mono text-[#f17827ff]">ROCK2025</span> to join iPod Shuffle
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// NAVIGATION DROPDOWNS
// ============================================================================

interface UserMenuDropdownProps {
  user: UserData
  onAccountSettings: () => void
  onLogout: () => void
}

// Component reserved for future use
const _UserMenuDropdown: React.FC<UserMenuDropdownProps> = ({ user, onAccountSettings, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f17827ff] to-[#d96a1f] flex items-center justify-center">
          <span className="text-white font-semibold text-sm">
            {user.displayName.charAt(0).toUpperCase()}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg shadow-xl z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <p className="text-white font-semibold text-sm">{user.displayName}</p>
            <p className="text-[#707070] text-xs mt-1">{user.email}</p>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={() => {
                onAccountSettings()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-white hover:bg-[#252525] transition-colors text-sm"
            >
              <Settings size={18} />
              <span>Account Settings</span>
            </button>
            <button
              onClick={() => {
                onLogout()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-[#a0a0a0] hover:bg-[#252525] hover:text-white transition-colors text-sm"
            >
              <LogOut size={18} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface BandSelectorDropdownProps {
  currentBand: BandDisplay
  bands: BandDisplay[]
  onSwitchBand: (bandId: string) => void
  onManageBand: () => void
  onCreateBand: () => void
  onJoinBand: () => void
}

// Component reserved for future use
const _BandSelectorDropdown: React.FC<BandSelectorDropdownProps> = ({
  currentBand,
  bands,
  onSwitchBand,
  onManageBand,
  onCreateBand,
  onJoinBand
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-[#1f1f1f] px-3 py-2 rounded-lg transition-colors"
      >
        <span className="text-white font-semibold text-base">{currentBand.name}</span>
        <ChevronDown size={18} className="text-[#a0a0a0]" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {/* Band List */}
          {bands.length > 1 && (
            <>
              <div className="px-4 py-2 border-b border-[#2a2a2a]">
                <p className="text-[#707070] text-xs font-semibold uppercase tracking-wider">Your Bands</p>
              </div>
              <div className="py-2">
                {bands.map((band) => (
                  <button
                    key={band.id}
                    onClick={() => {
                      onSwitchBand(band.id)
                      setIsOpen(false)
                    }}
                    className={`
                      w-full flex items-center justify-between px-4 py-3 hover:bg-[#252525] transition-colors
                      ${band.id === currentBand.id ? 'bg-[#252525]' : ''}
                    `}
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{band.name}</span>
                        {band.id === currentBand.id && (
                          <Check size={16} className="text-[#f17827ff]" />
                        )}
                      </div>
                      <p className="text-[#707070] text-xs mt-1">
                        {band.memberCount} members • {band.role}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="border-t border-[#2a2a2a]" />
            </>
          )}

          {/* Actions */}
          <div className="py-2">
            <button
              onClick={() => {
                onManageBand()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-white hover:bg-[#252525] transition-colors text-sm"
            >
              <Settings size={18} />
              <span>Manage Current Band</span>
            </button>
            <button
              onClick={() => {
                onCreateBand()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-white hover:bg-[#252525] transition-colors text-sm"
            >
              <UserPlus size={18} />
              <span>Create New Band</span>
            </button>
            <button
              onClick={() => {
                onJoinBand()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-white hover:bg-[#252525] transition-colors text-sm"
            >
              <Ticket size={18} />
              <span>Join Band</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MODALS
// ============================================================================

interface CreateBandModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (bandName: string) => void
}

// Component reserved for future use
const _CreateBandModal: React.FC<CreateBandModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [bandName, setBandName] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  // PHASE 2 DATABASE INTEGRATION: Use the createBand hook
  const { createBand } = useCreateBand()

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!bandName) {
      setErrors({ bandName: 'Band name is required' })
      return
    }
    if (bandName.length < 2) {
      setErrors({ bandName: 'Band name must be at least 2 characters' })
      return
    }

    setLoading(true)

    try {
      // PHASE 2 DATABASE INTEGRATION: Create band with real database
      const currentUserId = localStorage.getItem('currentUserId')
      if (!currentUserId) {
        throw new Error('No user logged in')
      }

      const bandId = await createBand({ name: bandName, description }, currentUserId)

      if (!bandId) {
        throw new Error('Failed to create band')
      }

      // Generate invite code
      const randomDigits = Math.floor(1000 + Math.random() * 9000)
      const generatedCode = 'ROCK' + randomDigits

      await db.inviteCodes.add({
        id: crypto.randomUUID(),
        bandId,
        code: generatedCode,
        createdBy: currentUserId,
        currentUses: 0,
        maxUses: 999,
        createdDate: new Date(),
        isActive: true
      })

      setLoading(false)
      onSuccess(bandName)
      setBandName('')
      setDescription('')
      setErrors({})
    } catch (err) {
      console.error('Error creating band:', err)
      setErrors({ bandName: 'Failed to create band. Please try again.' })
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a] max-w-md w-full">
        <h3 className="text-xl font-bold text-white mb-6">Create New Band</h3>

        <InputField
          label="Band Name"
          type="text"
          value={bandName}
          onChange={(value) => {
            setBandName(value)
            setErrors({})
          }}
          error={errors.bandName}
          placeholder="Enter band name"
        />

        <div className="mb-6">
          <label className="block text-sm font-medium text-white mb-2">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us about your band..."
            rows={3}
            className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 focus:border-[#f17827ff] resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>
            Create Band
          </Button>
        </div>
      </div>
    </div>
  )
}

interface JoinBandModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (bandName: string) => void
}

// Component reserved for future use
const _JoinBandModal: React.FC<JoinBandModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [inviteCode, setInviteCode] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!inviteCode) {
      setErrors({ inviteCode: 'Invite code is required' })
      return
    }

    setLoading(true)

    try {
      // PHASE 2 DATABASE INTEGRATION: Query database for invite code
      const currentUserId = localStorage.getItem('currentUserId')
      if (!currentUserId) {
        throw new Error('No user logged in')
      }

      const foundCode = await db.inviteCodes
        .where('code')
        .equals(inviteCode.toUpperCase())
        .first()

      if (foundCode) {
        // Validation checks
        if (foundCode.maxUses && foundCode.currentUses >= foundCode.maxUses) {
          setLoading(false)
          setErrors({ inviteCode: 'This invite code has reached its maximum uses' })
          return
        }

        if (foundCode.expiresAt && new Date() > foundCode.expiresAt) {
          setLoading(false)
          setErrors({ inviteCode: 'This invite code has expired' })
          return
        }

        const bandId = foundCode.bandId

        // Check if already a member
        const existingMembership = await db.bandMemberships
          .where('userId')
          .equals(currentUserId)
          .and(m => m.bandId === bandId)
          .first()

        if (existingMembership) {
          setLoading(false)
          setErrors({ inviteCode: 'You are already a member of this band' })
          return
        }

        // Create membership
        await db.bandMemberships.add({
          id: crypto.randomUUID(),
          userId: currentUserId,
          bandId,
          role: 'member',
          joinedDate: new Date(),
          status: 'active',
          permissions: ['member']
        })

        // Increment uses
        await db.inviteCodes.update(foundCode.id, {
          currentUses: foundCode.currentUses + 1
        })

        // Get band name
        const band = await db.bands.get(bandId)

        setLoading(false)
        onSuccess(band?.name || 'the band')
        setInviteCode('')
        setErrors({})
      } else {
        setLoading(false)
        setErrors({ inviteCode: 'Invalid invite code' })
      }
    } catch (err) {
      console.error('Error joining band:', err)
      setErrors({ inviteCode: 'Failed to join band. Please try again.' })
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a] max-w-md w-full">
        <h3 className="text-xl font-bold text-white mb-6">Join Band</h3>

        <div className="mb-6">
          <label className="block text-sm font-medium text-white mb-2">
            Invite Code
          </label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => {
              setInviteCode(e.target.value.toUpperCase())
              setErrors({})
            }}
            placeholder="ROCK2025"
            className={`
              w-full h-11 px-4 bg-[#0a0a0a] border rounded-lg text-white text-sm
              font-mono text-center tracking-wider uppercase
              placeholder-[#707070] transition-colors
              focus:outline-none focus:ring-2
              ${errors.inviteCode
                ? 'border-[#D7263D] focus:border-[#D7263D] focus:ring-[#D7263D]/20'
                : 'border-[#2a2a2a] focus:border-[#f17827ff] focus:ring-[#f17827ff]/20'
              }
            `}
          />
          {errors.inviteCode && (
            <p className="mt-1 text-sm text-[#D7263D] flex items-center gap-1">
              <AlertCircle size={14} />
              {errors.inviteCode}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>
            Join Band
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// DEMO APP WITH ALL COMPONENTS
// ============================================================================

// ============================================================================
// MAIN COMPONENT - AuthPages Demo
// ============================================================================

export const AuthPages: React.FC = () => {
  const location = useLocation()
  const [showSignup, setShowSignup] = useState(false)

  // Route based on URL path
  const currentPath = location.pathname

  if (currentPath === '/get-started') {
    return <GetStartedPage />
  }

  // /auth route - show login or signup
  if (showSignup) {
    return (
      <SignUpPage
        onSwitchToLogin={() => setShowSignup(false)}
      />
    )
  }

  // Default: show login page
  return (
    <LoginPage
      onSuccess={() => {/* Navigate handled in LoginPage */}}
      onSwitchToSignup={() => setShowSignup(true)}
    />
  )
}

export default AuthPages
