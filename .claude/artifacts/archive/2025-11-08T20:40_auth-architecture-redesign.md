# Authentication Architecture - Simplified Redesign

**Created:** 2025-11-08T20:40
**Updated:** 2025-11-08T20:45
**Problem:** Duplicate code paths, race conditions, unpredictable navigation behavior

## Core Principles

1. **Single Responsibility**: One component owns one concern
2. **Single Source of Truth**: Auth state lives in one place
3. **Predictable Flow**: Operations complete in order
4. **Simple Promises**: No dangling promises or fire-and-forget
5. **Easy to Test**: Clear inputs, outputs, and state transitions

## Current Architecture Problems

### Problem 1: Duplicate Sync Logic

**SupabaseAuthService** has TWO code paths that both call `syncUserToLocalDB()`:

```typescript
// Path 1: Direct call in signIn()
async signIn(credentials) {
  const { data } = await supabase.auth.signInWithPassword({...})
  const session = await this.mapSupabaseSession(data.session)
  await this.syncUserToLocalDB(session.user)  // ← HERE
  return { user, session }
}

// Path 2: Event handler
onAuthStateChange((event, supabaseSession) => {
  if (event === 'SIGNED_IN') {
    await this.syncUserToLocalDB(session.user)  // ← ALSO HERE!
  }
  this.notifyListeners(session)
})
```

**Result:** Race condition - both run simultaneously when user logs in.

### Problem 2: Complex Async Coordination

**AuthContext** tries to do everything at once:
- Listen to auth state changes
- Load user from database
- Load bands
- Run initial sync
- Set up realtime
- Update React state
- Set localStorage

All triggered by `onAuthStateChange` while `signIn()` promise is still pending.

### Problem 3: No Coordination Between Layers

```
AuthPages ────signIn()────> AuthContext ────signIn()────> SupabaseAuthService
     ↓                           ↓                              ↓
  navigate('/')           returns {}                    onAuthStateChange fires
     ↓                           |                              ↓
  BUT WHEN???              immediately                    triggers listener
                                                               ↓
                                                         AuthContext handler
                                                               ↓
                                                         loads bands, syncs...
```

**Result:** `navigate('/')` might execute before auth setup is complete, or might never execute due to component re-renders.

## Proposed Solution: Layered Architecture

### Layer 1: SupabaseAuthService (Authentication Only)

**Responsibility:** Talk to Supabase, nothing else.

```typescript
class SupabaseAuthService {
  // ❌ REMOVE: syncUserToLocalDB() - not auth's job
  // ❌ REMOVE: onAuthStateChange handling - let consumers handle it
  // ✅ KEEP: Pure Supabase operations

  async signIn(credentials): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword(credentials)
    if (error) return { error: error.message }

    // Just return the session - don't do any database work
    return {
      user: this.mapUser(data.user),
      session: this.mapSession(data.session)
    }
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  // Expose Supabase's onAuthStateChange for consumers
  onAuthStateChange(callback): Unsubscribe {
    const { data } = supabase.auth.onAuthStateChange(callback)
    return data.subscription.unsubscribe
  }
}
```

**Benefits:**
- Simple, predictable
- Easy to test
- No hidden side effects
- Single responsibility

### Layer 2: AuthContext (Orchestration)

**Responsibility:** Coordinate auth, database, and sync operations.

```typescript
export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState<'idle' | 'signing-in' | 'authenticated' | 'unauthenticated'>('idle')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentBand, setCurrentBand] = useState<Band | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Single auth state change handler
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await handleSignedIn(session)
      } else if (event === 'SIGNED_OUT') {
        handleSignedOut()
      }
    })

    return unsubscribe
  }, [])

  // Coordinated sign-in that waits for everything
  const signIn = async (credentials): Promise<{ error?: string }> => {
    setAuthState('signing-in')
    setError(null)

    try {
      // 1. Authenticate with Supabase
      const { user, session, error } = await authService.signIn(credentials)
      if (error) {
        setAuthState('unauthenticated')
        return { error }
      }

      // 2. Wait for auth state handler to complete
      await waitForAuthState('authenticated', 10000)

      // 3. Return success only after everything is ready
      return {}
    } catch (error) {
      setAuthState('unauthenticated')
      setError(error.message)
      return { error: error.message }
    }
  }

  // Handle sign-in orchestration
  const handleSignedIn = async (session: AuthSession) => {
    try {
      // 1. Sync user to local DB
      await syncUserToLocalDB(session.user)

      // 2. Load user's bands
      const bands = await loadUserBands(session.user.id)

      // 3. Select first band (or saved preference)
      const bandId = localStorage.getItem('currentBandId') || bands[0]?.id
      if (!bandId) throw new Error('No bands found')

      // 4. Run initial sync
      await runInitialSync(session.user.id, bandId)

      // 5. Set up realtime
      const realtimeManager = new RealtimeManager(...)
      await realtimeManager.subscribe([bandId])

      // 6. Update state (triggers re-render)
      setCurrentUser(session.user)
      setCurrentBand(bands.find(b => b.id === bandId))
      setAuthState('authenticated')

      // 7. Save to localStorage
      localStorage.setItem('currentUserId', session.user.id)
      localStorage.setItem('currentBandId', bandId)
    } catch (error) {
      console.error('Sign-in setup failed:', error)
      setAuthState('unauthenticated')
      setError(error.message)
      // Sign out to clean up partial state
      await authService.signOut()
    }
  }

  // Helper: Wait for auth state to reach target
  const waitForAuthState = (target: string, timeout: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (authState === target) {
        resolve()
        return
      }

      const timer = setTimeout(() => {
        reject(new Error(`Auth state timeout waiting for: ${target}`))
      }, timeout)

      // Watch for state change
      const unsubscribe = subscribeToAuthState((state) => {
        if (state === target) {
          clearTimeout(timer)
          unsubscribe()
          resolve()
        }
      })
    })
  }

  return (
    <AuthContext.Provider value={{
      authState,
      currentUser,
      currentBand,
      error,
      signIn,
      signOut,
      isAuthenticated: authState === 'authenticated'
    }}>
      {children}
    </AuthContext.Provider>
  )
}
```

**Benefits:**
- Single orchestration point
- Clear async coordination
- Proper error handling
- Easy to test each step

### Layer 3: AuthPages (UI Only)

**Responsibility:** Display UI and call AuthContext methods.

```typescript
const AuthPages = () => {
  const { signIn, authState, error } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await signIn({ email, password })

    if (error) {
      // Show error to user
      toast.error(error)
    } else {
      // Auth is fully ready, safe to navigate
      navigate('/')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button disabled={authState === 'signing-in'}>
        {authState === 'signing-in' ? 'Loading...' : 'Log In'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  )
}
```

**Benefits:**
- Simple, declarative
- No business logic
- Easy to test
- Clear user feedback

## Migration Strategy

### Phase 1: Add waitForAuthState() Helper (Quick Win)

Add this to current AuthContext without major refactor:

```typescript
// In AuthContext
const [authReady, setAuthReady] = useState(false)

const signIn = async (credentials) => {
  setAuthReady(false)
  const response = await authService.signIn(credentials)
  if (response.error) return response

  // Wait for auth to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Auth setup timeout'))
    }, 10000)

    const checkReady = setInterval(() => {
      if (authReady) {
        clearInterval(checkReady)
        clearTimeout(timeout)
        resolve()
      }
    }, 100)
  })

  return {}
}

// In onAuthStateChange handler, after all setup:
setAuthReady(true)
```

**Pros:** Minimal changes, fixes immediate issue
**Cons:** Still has duplicate sync logic

### Phase 2: Remove Duplicate syncUserToLocalDB()

Move all database sync logic out of SupabaseAuthService into AuthContext.

### Phase 3: Full Refactor

Implement the layered architecture above.

## Testing Strategy

### Unit Tests

```typescript
describe('AuthContext.signIn()', () => {
  it('should not resolve until auth state is ready', async () => {
    const { result } = renderHook(() => useAuth())

    const promise = result.current.signIn({ email: 'test@example.com', password: 'test123' })

    // Should not resolve immediately
    await waitFor(() => {
      expect(result.current.authState).toBe('signing-in')
    })

    // Should resolve after auth is ready
    await waitFor(() => {
      expect(result.current.authState).toBe('authenticated')
    })

    await promise
  })

  it('should set localStorage before resolving', async () => {
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signIn({ email: 'test@example.com', password: 'test123' })
    })

    expect(localStorage.getItem('currentUserId')).toBeTruthy()
    expect(localStorage.getItem('currentBandId')).toBeTruthy()
  })

  it('should timeout if auth setup takes too long', async () => {
    mockSlowAuthSetup()

    const { result } = renderHook(() => useAuth())

    await expect(
      result.current.signIn({ email: 'test@example.com', password: 'test123' })
    ).rejects.toThrow('Auth setup timeout')
  })
})
```

### Integration Tests with Chrome MCP

```typescript
describe('Auth Flow E2E', () => {
  it('should complete full login flow', async () => {
    await chromeMCP.navigate('http://localhost:4173/auth')
    await chromeMCP.fill('email', 'eric@ipodshuffle.com')
    await chromeMCP.fill('password', 'test123')
    await chromeMCP.click('Log In')

    // Should redirect to home
    await chromeMCP.waitForUrl('http://localhost:4173/')

    // Should have user data in localStorage
    const storage = await chromeMCP.evaluate(() => ({
      userId: localStorage.getItem('currentUserId'),
      bandId: localStorage.getItem('currentBandId')
    }))

    expect(storage.userId).toBeTruthy()
    expect(storage.bandId).toBeTruthy()
  })

  it('should show user content after login', async () => {
    // ... complete login ...

    await chromeMCP.waitFor('text:Songs')
    const songs = await chromeMCP.evaluate(() =>
      document.querySelectorAll('[data-testid="song-item"]').length
    )
    expect(songs).toBeGreaterThan(0)
  })
})
```

## Success Criteria

✅ Login completes and navigates to home page 100% of the time
✅ No race conditions
✅ Clear error messages on failure
✅ Tests pass reliably
✅ No duplicate sync operations
✅ Predictable timing (completes within 5 seconds)
✅ Works after page refresh
✅ Works after logout → login again

## Next Steps

1. Discuss approach with user
2. Implement Phase 1 (quick win)
3. Test with Chrome MCP
4. Implement Phase 2 & 3 if needed
5. Deploy with confidence
