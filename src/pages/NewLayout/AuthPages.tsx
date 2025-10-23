import React, { useState, useRef, useEffect } from 'react'
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
// TYPES & INTERFACES
// ============================================================================

interface UserData {
  id: string
  email: string
  displayName: string
  password: string
}

interface Band {
  id: string
  name: string
  memberCount: number
  role: 'Owner' | 'Member'
  inviteCode: string
}

interface FormErrors {
  [key: string]: string
}

type AuthView = 'login' | 'signup' | 'get-started' | 'account-settings' | 'app'

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_USER: UserData = {
  id: 'user-1',
  email: 'eric@example.com',
  displayName: 'Eric Johnson',
  password: 'password123'
}

const MOCK_BANDS: Band[] = [
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
  onSuccess: () => void
  onSwitchToLogin: () => void
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onSuccess, onSwitchToLogin }) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        onSuccess()
      }, 1000)
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
  onSuccess: (hasNoBands?: boolean) => void
  onSwitchToSignup: () => void
}

const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onSwitchToSignup }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        // Check mock credentials
        if (email === MOCK_USER.email && password === MOCK_USER.password) {
          onSuccess(false) // Has bands
        } else {
          setErrors({ password: 'Invalid email or password' })
        }
      }, 1000)
    }
  }

  const handleGoogleSignIn = () => {
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
  onComplete: () => void
}

const GetStartedPage: React.FC<GetStartedPageProps> = ({ onComplete }) => {
  const [bandName, setBandName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const handleCreateBand = () => {
    if (!bandName) {
      setErrors({ bandName: 'Band name is required' })
      return
    }
    if (bandName.length < 2) {
      setErrors({ bandName: 'Band name must be at least 2 characters' })
      return
    }

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      const generatedCode = 'ROCK' + Math.floor(Math.random() * 10000)
      setToast({
        message: `Band created! Share this invite code: ${generatedCode}`,
        type: 'success'
      })
      setTimeout(() => {
        onComplete()
      }, 2000)
    }, 1000)
  }

  const handleJoinBand = () => {
    if (!inviteCode) {
      setErrors({ inviteCode: 'Invite code is required' })
      return
    }

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      // Check if code exists in mock data
      const band = MOCK_BANDS.find(b => b.inviteCode === inviteCode.toUpperCase())
      if (band) {
        setToast({
          message: `You joined ${band.name}!`,
          type: 'success'
        })
        setTimeout(() => {
          onComplete()
        }, 2000)
      } else {
        setErrors({ inviteCode: 'Invalid invite code' })
      }
    }, 1000)
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
// ACCOUNT SETTINGS PAGE
// ============================================================================

interface AccountSettingsPageProps {
  user: UserData
  onUpdateUser: (updates: Partial<UserData>) => void
  onLogout: () => void
}

const AccountSettingsPage: React.FC<AccountSettingsPageProps> = ({ user, onUpdateUser, onLogout }) => {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [theme, setTheme] = useState('dark')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const handleSaveProfile = () => {
    if (!displayName) {
      setErrors({ displayName: 'Display name is required' })
      return
    }
    if (displayName.length < 2) {
      setErrors({ displayName: 'Display name must be at least 2 characters' })
      return
    }

    onUpdateUser({ displayName })
    setToast({ message: 'Profile updated', type: 'success' })
  }

  const handleChangePassword = () => {
    const newErrors: FormErrors = {}

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required'
    } else if (currentPassword !== user.password) {
      newErrors.currentPassword = 'Current password is incorrect'
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required'
    } else if (!validatePassword(newPassword)) {
      newErrors.newPassword = 'Password must be at least 8 characters'
    }

    if (!confirmNewPassword) {
      newErrors.confirmNewPassword = 'Please confirm your password'
    } else if (newPassword !== confirmNewPassword) {
      newErrors.confirmNewPassword = 'Passwords do not match'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onUpdateUser({ password: newPassword })
    setCurrentPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setErrors({})
    setToast({ message: 'Password changed', type: 'success' })
  }

  const handleDeleteAccount = () => {
    if (deleteConfirmation === 'DELETE') {
      setToast({ message: 'Account deleted', type: 'success' })
      setTimeout(() => {
        onLogout()
      }, 1500)
    }
  }

  return (
    <div className="min-h-screen bg-[#121212] py-8 px-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Account Settings</h1>
          <p className="text-[#a0a0a0]">Manage your account information and preferences</p>
        </div>

        {/* Profile Section */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a] mb-6">
          <h2 className="text-xl font-bold text-white mb-6">Profile</h2>

          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#f17827ff] to-[#d96a1f] flex items-center justify-center">
              <span className="text-white font-bold text-2xl">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <button className="px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-[#707070] text-sm font-medium cursor-not-allowed">
                Change Photo (Coming Soon)
              </button>
            </div>
          </div>

          <InputField
            label="Display Name"
            type="text"
            value={displayName}
            onChange={setDisplayName}
            error={errors.displayName}
            placeholder="Your name"
          />

          <div className="mb-4">
            <label className="block text-sm font-medium text-white mb-2">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full h-11 px-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#707070] text-sm cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-[#707070]">Email cannot be changed at this time</p>
          </div>

          <Button variant="primary" onClick={handleSaveProfile}>
            Save Changes
          </Button>
        </div>

        {/* Security Section */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a] mb-6">
          <h2 className="text-xl font-bold text-white mb-6">Security</h2>

          <InputField
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            error={errors.currentPassword}
            placeholder="Enter current password"
            icon={<Lock size={18} />}
            showPasswordToggle
            showPassword={showCurrentPassword}
            onTogglePassword={() => setShowCurrentPassword(!showCurrentPassword)}
          />

          <InputField
            label="New Password"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            error={errors.newPassword}
            placeholder="At least 8 characters"
            icon={<Lock size={18} />}
            showPasswordToggle
            showPassword={showNewPassword}
            onTogglePassword={() => setShowNewPassword(!showNewPassword)}
          />

          <InputField
            label="Confirm New Password"
            type="password"
            value={confirmNewPassword}
            onChange={setConfirmNewPassword}
            error={errors.confirmNewPassword}
            placeholder="Re-enter new password"
            icon={<Lock size={18} />}
            showPasswordToggle
            showPassword={showConfirmNewPassword}
            onTogglePassword={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
          />

          <Button variant="primary" onClick={handleChangePassword}>
            Change Password
          </Button>
        </div>

        {/* Preferences Section */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a] mb-6">
          <h2 className="text-xl font-bold text-white mb-6">Preferences</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-[#2a2a2a]">
              <div>
                <label className="text-sm font-medium text-white">Theme</label>
                <p className="text-xs text-[#707070] mt-1">Choose your preferred color scheme</p>
              </div>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 focus:border-[#f17827ff]"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <label className="text-sm font-medium text-white">Email Notifications</label>
                <p className="text-xs text-[#707070] mt-1">Receive updates about your bands</p>
              </div>
              <button
                onClick={() => setEmailNotifications(!emailNotifications)}
                className={`
                  relative w-12 h-6 rounded-full transition-colors
                  ${emailNotifications ? 'bg-[#f17827ff]' : 'bg-[#2a2a2a]'}
                `}
              >
                <div
                  className={`
                    absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform
                    ${emailNotifications ? 'translate-x-6' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border-2 border-[#D7263D]/30">
          <h2 className="text-xl font-bold text-[#D7263D] mb-3">Danger Zone</h2>
          <p className="text-[#a0a0a0] text-sm mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
            Delete Account
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a] max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Delete Account</h3>
            <div className="mb-6">
              <p className="text-[#a0a0a0] text-sm mb-3">
                This will permanently delete your account and remove you from all bands.
              </p>
              <p className="text-[#D7263D] text-sm font-semibold mb-4">
                This action cannot be undone.
              </p>
              <label className="block text-sm font-medium text-white mb-2">
                Type <span className="font-mono text-[#D7263D]">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full h-11 px-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#D7263D]/20 focus:border-[#D7263D]"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmation('')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                fullWidth
                onClick={handleDeleteAccount}
                disabled={deleteConfirmation !== 'DELETE'}
              >
                Delete My Account
              </Button>
            </div>
          </div>
        </div>
      )}
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

const UserMenuDropdown: React.FC<UserMenuDropdownProps> = ({ user, onAccountSettings, onLogout }) => {
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
  currentBand: Band
  bands: Band[]
  onSwitchBand: (bandId: string) => void
  onManageBand: () => void
  onCreateBand: () => void
  onJoinBand: () => void
}

const BandSelectorDropdown: React.FC<BandSelectorDropdownProps> = ({
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

const CreateBandModal: React.FC<CreateBandModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [bandName, setBandName] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!bandName) {
      setErrors({ bandName: 'Band name is required' })
      return
    }
    if (bandName.length < 2) {
      setErrors({ bandName: 'Band name must be at least 2 characters' })
      return
    }

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onSuccess(bandName)
      setBandName('')
      setDescription('')
      setErrors({})
    }, 1000)
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

const JoinBandModal: React.FC<JoinBandModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [inviteCode, setInviteCode] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!inviteCode) {
      setErrors({ inviteCode: 'Invite code is required' })
      return
    }

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      const band = MOCK_BANDS.find(b => b.inviteCode === inviteCode.toUpperCase())
      if (band) {
        onSuccess(band.name)
        setInviteCode('')
        setErrors({})
      } else {
        setErrors({ inviteCode: 'Invalid invite code' })
      }
    }, 1000)
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

interface DemoAppProps {
  currentBand: Band
  user: UserData
  onAccountSettings: () => void
  onLogout: () => void
}

const DemoApp: React.FC<DemoAppProps> = ({ currentBand, user, onAccountSettings, onLogout }) => {
  const [showCreateBandModal, setShowCreateBandModal] = useState(false)
  const [showJoinBandModal, setShowJoinBandModal] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Demo Header */}
      <header className="bg-[#141414] border-b border-[#1f1f1f] p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Band Selector */}
          <BandSelectorDropdown
            currentBand={currentBand}
            bands={MOCK_BANDS}
            onSwitchBand={(bandId) => {
              const band = MOCK_BANDS.find(b => b.id === bandId)
              if (band) {
                setToast({ message: `Switched to ${band.name}`, type: 'info' })
              }
            }}
            onManageBand={() => setToast({ message: 'Navigate to Band Members page', type: 'info' })}
            onCreateBand={() => setShowCreateBandModal(true)}
            onJoinBand={() => setShowJoinBandModal(true)}
          />

          {/* User Menu */}
          <UserMenuDropdown
            user={user}
            onAccountSettings={onAccountSettings}
            onLogout={onLogout}
          />
        </div>
      </header>

      {/* Demo Content */}
      <main className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#1a1a1a] rounded-xl p-8 border border-[#2a2a2a] text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Welcome to Rock-On!</h1>
            <p className="text-[#a0a0a0] mb-6">
              You're logged in as <span className="text-white font-semibold">{user.displayName}</span>
            </p>
            <p className="text-[#707070] text-sm mb-4">
              Current Band: <span className="text-[#f17827ff] font-semibold">{currentBand.name}</span> ({currentBand.memberCount} members)
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button variant="secondary" onClick={() => setShowCreateBandModal(true)}>
                <UserPlus size={18} />
                Create New Band
              </Button>
              <Button variant="secondary" onClick={() => setShowJoinBandModal(true)}>
                <Ticket size={18} />
                Join Band
              </Button>
              <Button variant="secondary" onClick={onAccountSettings}>
                <Settings size={18} />
                Account Settings
              </Button>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
              <h3 className="text-lg font-bold text-white mb-2">User Menu</h3>
              <p className="text-[#a0a0a0] text-sm mb-4">Click your avatar (top-right) to access account settings and log out</p>
              <div className="flex items-center gap-2 text-[#f17827ff] text-sm">
                <User size={16} />
                <span>Top-right corner</span>
              </div>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
              <h3 className="text-lg font-bold text-white mb-2">Band Selector</h3>
              <p className="text-[#a0a0a0] text-sm mb-4">Switch between your bands or create/join new ones</p>
              <div className="flex items-center gap-2 text-[#f17827ff] text-sm">
                <Users size={16} />
                <span>Top-left corner</span>
              </div>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
              <h3 className="text-lg font-bold text-white mb-2">Mock Data</h3>
              <p className="text-[#a0a0a0] text-sm mb-4">All features use mock data - no database required</p>
              <div className="flex items-center gap-2 text-[#f17827ff] text-sm">
                <Check size={16} />
                <span>Ready to test</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <CreateBandModal
        isOpen={showCreateBandModal}
        onClose={() => setShowCreateBandModal(false)}
        onSuccess={(bandName) => {
          setShowCreateBandModal(false)
          setToast({ message: `Band "${bandName}" created!`, type: 'success' })
        }}
      />

      <JoinBandModal
        isOpen={showJoinBandModal}
        onClose={() => setShowJoinBandModal(false)}
        onSuccess={(bandName) => {
          setShowJoinBandModal(false)
          setToast({ message: `You joined ${bandName}!`, type: 'success' })
        }}
      />
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT - AuthPages Demo
// ============================================================================

export const AuthPages: React.FC = () => {
  const [currentView, setCurrentView] = useState<AuthView>('login')
  const [user, setUser] = useState<UserData>(MOCK_USER)
  const [currentBand] = useState<Band>(MOCK_BANDS[0])

  const handleUpdateUser = (updates: Partial<UserData>) => {
    setUser({ ...user, ...updates })
  }

  const handleLogout = () => {
    setCurrentView('login')
  }

  const handleLoginSuccess = (hasNoBands?: boolean) => {
    if (hasNoBands) {
      setCurrentView('get-started')
    } else {
      setCurrentView('app')
    }
  }

  const handleSignupSuccess = () => {
    setCurrentView('get-started')
  }

  const handleGetStartedComplete = () => {
    setCurrentView('app')
  }

  const handleAccountSettings = () => {
    setCurrentView('account-settings')
  }

  const handleBackToApp = () => {
    setCurrentView('app')
  }

  // Render based on current view
  if (currentView === 'login') {
    return (
      <LoginPage
        onSuccess={handleLoginSuccess}
        onSwitchToSignup={() => setCurrentView('signup')}
      />
    )
  }

  if (currentView === 'signup') {
    return (
      <SignUpPage
        onSuccess={handleSignupSuccess}
        onSwitchToLogin={() => setCurrentView('login')}
      />
    )
  }

  if (currentView === 'get-started') {
    return (
      <GetStartedPage onComplete={handleGetStartedComplete} />
    )
  }

  if (currentView === 'account-settings') {
    return (
      <div className="relative">
        {/* Back Button */}
        <div className="fixed top-6 left-6 z-10">
          <Button variant="secondary" onClick={handleBackToApp}>
            Back to App
          </Button>
        </div>
        <AccountSettingsPage
          user={user}
          onUpdateUser={handleUpdateUser}
          onLogout={handleLogout}
        />
      </div>
    )
  }

  // Default: app view
  return (
    <DemoApp
      currentBand={currentBand}
      user={user}
      onAccountSettings={handleAccountSettings}
      onLogout={handleLogout}
    />
  )
}

export default AuthPages
