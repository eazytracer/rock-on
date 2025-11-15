/**
 * Authentication Flow Mermaid Diagrams
 *
 * Generated from .claude/specifications/user-flows/authentication-flow.md
 */

export const authFlowDiagrams = {
  /**
   * New User Sign Up - Email/Password
   */
  signupEmail: `
sequenceDiagram
    participant User
    participant UI as Sign Up Form
    participant App as Application
    participant Supa as Supabase Auth
    participant DB as Database
    participant Email as Email Service

    User->>UI: Navigate to /signup
    UI->>User: Show sign up form

    User->>UI: Enter name, email, password
    UI->>UI: Validate form (client-side)
    Note over UI: Email format, password strength,<br/>password confirmation match

    User->>UI: Click "Sign Up"
    UI->>UI: Disable form, show loading

    UI->>App: signUp(email, password, metadata)
    App->>Supa: auth.signUp({email, password, data: {name}})

    alt Account Created Successfully
        Supa->>DB: Create user record
        DB-->>Supa: User created
        Supa->>Email: Send confirmation email
        Supa-->>App: {user, session: null}

        alt Email Confirmation Required
            App-->>UI: Show "Check your email"
            UI->>User: Display confirmation message
            Note over User: User must confirm email<br/>before proceeding
        else Email Confirmation Disabled (Dev)
            App->>DB: Create user_profile
            App-->>UI: Auto sign in
            UI->>User: Redirect to /get-started
        end

    else Email Already Exists
        Supa-->>App: Error: "Email already registered"
        App-->>UI: Show error message
        UI->>User: Display: "Email already registered"

    else Weak Password
        Supa-->>App: Error: "Password too weak"
        App-->>UI: Show error message
        UI->>User: Display: "Password must be at least 8 characters"

    else Network Error
        Supa-->>App: Network timeout
        App-->>UI: Show error message
        UI->>User: Display: "Unable to create account. Try again."
    end
`,

  /**
   * New User Sign Up - Google OAuth
   */
  signupGoogle: `
sequenceDiagram
    participant User
    participant UI as Sign In Page
    participant App as Application
    participant Supa as Supabase Auth
    participant Google as Google OAuth
    participant DB as Database

    User->>UI: Navigate to /signin
    UI->>User: Show sign in options

    User->>UI: Click "Sign in with Google"
    UI->>App: signInWithGoogle()
    App->>Supa: auth.signInWithOAuth({provider: 'google'})

    Supa->>Google: Redirect to Google OAuth
    Google->>User: Show Google account picker
    User->>Google: Select account & grant permissions

    Google->>Supa: Redirect with OAuth code
    Supa->>Google: Exchange code for tokens
    Google-->>Supa: Access token + user info

    Supa->>DB: Upsert user record
    DB-->>Supa: User created/updated

    Supa->>UI: Redirect to /auth/callback
    UI->>App: Extract session from URL
    App->>Supa: auth.getSession()
    Supa-->>App: {user, session}

    alt New User (First Sign In)
        App->>DB: Check if user_profile exists
        DB-->>App: Profile not found
        App->>DB: Create user_profile
        DB-->>App: Profile created
        App-->>UI: Redirect to /get-started
        UI->>User: Show band creation/joining options

    else Existing User
        App->>DB: Fetch user data
        DB-->>App: User profile + band memberships
        App-->>UI: Redirect to /bands or /dashboard
        UI->>User: Show main application
    end
`,

  /**
   * Returning User Sign In - Email/Password
   */
  signinEmail: `
sequenceDiagram
    participant User
    participant UI as Sign In Form
    participant App as Application
    participant Supa as Supabase Auth
    participant DB as Database
    participant IDB as IndexedDB

    User->>UI: Navigate to /signin
    UI->>User: Show sign in form

    User->>UI: Enter email & password
    User->>UI: Click "Sign In"
    UI->>UI: Disable form, show loading

    UI->>App: signIn(email, password)
    App->>Supa: auth.signInWithPassword({email, password})

    alt Valid Credentials
        Supa->>DB: Update last_login timestamp
        Supa-->>App: {user, session}

        App->>IDB: Check local data exists
        IDB-->>App: Local data found

        App->>DB: Fetch band memberships
        DB-->>App: User's bands

        alt User Has Bands
            App-->>UI: Redirect to /bands or /dashboard
            UI->>User: Show main application
            Note over App,DB: Background: Start realtime sync

        else User Has No Bands
            App-->>UI: Redirect to /get-started
            UI->>User: Show band creation/joining options
        end

    else Invalid Credentials
        Supa-->>App: Error: "Invalid credentials"
        App-->>UI: Show error message
        UI->>User: Display: "Invalid email or password"

    else Unconfirmed Email
        Supa-->>App: Error: "Email not confirmed"
        App-->>UI: Show error message
        UI->>User: Display: "Please confirm your email"

    else Network Error (Offline)
        Supa-->>App: Network timeout
        App->>IDB: Check cached session
        IDB-->>App: Valid cached session found

        App-->>UI: Sign in with cached session
        UI->>User: Show offline mode indicator
        Note over User,IDB: Local-first: User can access<br/>their data offline
    end
`,

  /**
   * Band Creation Flow
   */
  bandCreation: `
sequenceDiagram
    participant User
    participant UI as Get Started Page
    participant App as Application
    participant DB as Supabase
    participant IDB as IndexedDB

    User->>UI: At /get-started
    UI->>User: Show "Create Band" vs "Join Band"

    User->>UI: Click "Create a new band"
    UI->>User: Show band creation form

    User->>UI: Enter band name
    User->>UI: Click "Create Band"
    UI->>UI: Show loading state

    UI->>App: createBand({name})

    App->>DB: INSERT into bands
    DB->>DB: Generate band UUID
    DB->>DB: Set created_by = current_user
    DB->>DB: Set version = 1
    DB-->>App: Band created {id, name, ...}

    App->>DB: INSERT into band_memberships
    Note over DB: User becomes admin of new band
    DB-->>App: Membership created {role: 'admin'}

    App->>DB: Generate invite code
    DB->>DB: INSERT into invite_codes
    Note over DB: 6-character code, expires in 7 days
    DB-->>App: Invite code created

    App->>IDB: Save band to IndexedDB
    IDB-->>App: Saved locally

    App->>IDB: Save membership to IndexedDB
    IDB-->>App: Saved locally

    App->>App: Set currentBandId = band.id
    App-->>UI: Band created successfully

    UI->>User: Redirect to /dashboard
    Note over User,UI: User is now in their new band<br/>with admin privileges

    UI->>User: Show empty state
    Note over User: "Add your first song"<br/>"Create your first setlist"
`,

  /**
   * Band Joining Flow
   */
  bandJoining: `
sequenceDiagram
    participant User
    participant UI as Get Started Page
    participant App as Application
    participant DB as Supabase
    participant IDB as IndexedDB
    participant Admin as Band Admin

    User->>UI: At /get-started
    UI->>User: Show "Create Band" vs "Join Band"

    User->>UI: Click "Join an existing band"
    UI->>User: Show invite code form
    Note over UI: Input field for 6-character code

    User->>UI: Enter invite code (e.g., "ABC123")
    User->>UI: Click "Join Band"
    UI->>UI: Show loading state

    UI->>App: joinBand(inviteCode)
    App->>DB: SELECT * FROM invite_codes WHERE code = 'ABC123'

    alt Valid Invite Code
        DB-->>App: {band_id, expires_at, max_uses, current_uses}

        App->>App: Validate code not expired
        App->>App: Validate uses < max_uses

        App->>DB: Check if user already member
        DB-->>App: User not a member

        App->>DB: INSERT into band_memberships
        Note over DB: User joins as regular member (not admin)
        DB-->>App: Membership created {role: 'member'}

        App->>DB: UPDATE invite_codes SET current_uses++
        DB-->>App: Usage count updated

        App->>DB: Fetch band details
        DB-->>App: {band: {name, ...}}

        App->>IDB: Save band to IndexedDB
        IDB-->>App: Saved locally

        App->>IDB: Save membership to IndexedDB
        IDB-->>App: Saved locally

        App->>DB: Sync band's songs, setlists
        Note over App,DB: Download existing band data
        DB-->>App: Band data synced

        App->>IDB: Save band data locally
        IDB-->>App: All data saved

        App->>App: Set currentBandId = band.id
        App-->>UI: Joined successfully

        UI->>User: Redirect to /dashboard
        Note over User: User can now see and edit<br/>band's songs and setlists

    else Invalid Code
        DB-->>App: Code not found
        App-->>UI: Show error
        UI->>User: Display: "Invalid invite code"

    else Expired Code
        DB-->>App: Code expired
        App-->>UI: Show error
        UI->>User: Display: "This invite code has expired"

    else Max Uses Reached
        DB-->>App: current_uses >= max_uses
        App-->>UI: Show error
        UI->>User: Display: "This invite code is no longer valid"

    else Already a Member
        DB-->>App: Membership exists
        App-->>UI: Show info message
        UI->>User: Display: "You're already a member!"
        UI->>User: Redirect to /dashboard
    end
`,
}
