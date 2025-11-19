# Local Development Setup Guide
## External Services Configuration for Rock On!

This guide covers setting up the external services needed for local development and testing of the multi-user authentication system.

---

## Supabase Setup (Free Tier)

### 1. Create Supabase Account
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. Verify your email if using email signup

### 2. Create New Project
1. Click "New Project" in dashboard
2. Choose your organization (personal is fine)
3. Fill out project details:
   ```
   Name: rock-on-dev
   Database Password: [Generate strong password - save this!]
   Region: [Choose closest to you]
   Pricing Plan: Free
   ```
4. Click "Create new project"
5. Wait 2-3 minutes for project setup

### 3. Configure Authentication
1. In your project dashboard, go to **Authentication** → **Settings**
2. Under **Site URL**, add:
   ```
   http://localhost:5173
   ```
3. Under **Redirect URLs**, add:
   ```
   http://localhost:5173
   http://localhost:5173/auth/callback
   ```

### 4. Enable OAuth Providers (Google)
1. Go to **Authentication** → **Providers**
2. Find **Google** and click to configure
3. Toggle **Enable sign in with Google** to ON
4. You'll need Google OAuth credentials (see Google setup below)
5. For now, you can enable **Email** provider which requires no external setup

### 5. Get Your API Keys
1. Go to **Settings** → **API**
2. Copy these values (you'll add them to your `.env` file):
   ```
   Project URL: https://your-project-ref.supabase.co
   anon/public key: eyJ... (long string)
   service_role key: eyJ... (longer string - keep secret!)
   ```

---

## Google OAuth Setup (Optional - for OAuth testing)

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click "Create Project" or select project dropdown
4. Fill out:
   ```
   Project Name: rock-on-dev
   Organization: [Leave default or select]
   Location: [Leave default]
   ```
5. Click "Create"

### 2. Enable Google+ API
1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click on it and click "Enable"

### 3. Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (Internal requires Google Workspace)
3. Fill out required fields:
   ```
   App name: Rock On! Dev
   User support email: [your email]
   Developer contact: [your email]
   ```
4. Skip optional fields for now
5. Click "Save and Continue" through all steps
6. On Review page, click "Back to Dashboard"

### 4. Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Fill out:
   ```
   Name: Rock On Web Client
   Authorized JavaScript origins:
   - http://localhost:5173
   - https://your-project-ref.supabase.co

   Authorized redirect URIs:
   - https://your-project-ref.supabase.co/auth/v1/callback
   ```
5. Click "Create"
6. Copy the **Client ID** and **Client Secret**

### 5. Configure Supabase with Google OAuth
1. Back in Supabase, go to **Authentication** → **Providers** → **Google**
2. Paste your Google **Client ID** and **Client Secret**
3. Click "Save"

---

## Local Environment Configuration

### 1. Create Environment File
Create `.env.local` in your project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Google OAuth (if you set it up)
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Development flags
VITE_ENABLE_AUTH=true
VITE_MOCK_AUTH=false  # Set to true to use mock auth for testing
```

### 2. Add Environment File to .gitignore
Ensure `.env.local` is in your `.gitignore`:

```bash
# Environment files
.env.local
.env.development.local
.env.test.local
.env.production.local
```

---

## Mock Authentication for Local Development

For development without external dependencies, we'll create a mock auth system that uses the same interfaces.

### Mock Auth Features:
- Fake user accounts (no real signup required)
- Simulated OAuth flow
- Local session persistence
- Same API as real Supabase auth

### Switching Between Mock and Real Auth:
Set `VITE_MOCK_AUTH=true` in `.env.local` to use mock authentication.

---

## Database Setup (Local Only)

### Supabase Tables (Optional - for real auth testing)
If you want to test with real Supabase backend later, here are the tables to create:

```sql
-- User profiles (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  primary_instrument TEXT,
  instruments TEXT[],
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Band memberships for cross-device sync
CREATE TABLE public.band_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  band_id TEXT NOT NULL, -- Maps to IndexedDB band ID
  role TEXT NOT NULL,
  permissions TEXT[] DEFAULT '{"member"}',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active'
);

-- Invite codes for band joining
CREATE TABLE public.invite_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.user_profiles(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER DEFAULT 10,
  current_uses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Band members can view memberships" ON public.band_memberships
  FOR SELECT USING (user_id = auth.uid() OR band_id IN (
    SELECT band_id FROM public.band_memberships WHERE user_id = auth.uid()
  ));
```

---

## Development Workflow Options

### Option 1: Mock Auth Only (Fastest)
```bash
# In .env.local
VITE_MOCK_AUTH=true
VITE_ENABLE_AUTH=true
```
- No external services needed
- Instant development
- Full multi-user simulation
- Perfect for UI development

### Option 2: Supabase Auth + Local Data
```bash
# In .env.local
VITE_MOCK_AUTH=false
VITE_ENABLE_AUTH=true
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
- Real authentication
- IndexedDB for all app data
- Tests real OAuth flows
- Good for auth integration testing

### Option 3: Full Supabase (Later)
- Real authentication
- Some data in Supabase for sync
- Most data still in IndexedDB
- Production-like testing

---

## Quick Start Commands

```bash
# 1. Install dependencies
npm install @supabase/supabase-js @supabase/auth-ui-react

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# 3. Start development (mock auth)
VITE_MOCK_AUTH=true npm run dev

# 4. Start development (real auth)
VITE_MOCK_AUTH=false npm run dev
```

---

## Testing Scenarios

### Mock Auth Testing:
- Multiple fake users (Alice, Bob, Charlie)
- Instant band creation and joining
- No rate limits or network issues
- Perfect for rapid iteration

### Real Auth Testing:
- Real Google OAuth flow
- Email/password signup
- Session persistence across browser restarts
- Network failure handling

---

## Troubleshooting

### Supabase Issues:
- **"Invalid API key"**: Check your project URL and anon key
- **"Not authorized"**: Check your site URL in Supabase dashboard
- **Google OAuth fails**: Verify your redirect URIs match exactly

### Local Development:
- **Environment variables not loading**: Restart dev server after changing .env.local
- **CORS errors**: Make sure localhost:5173 is in your Supabase allowed origins

### Mock Auth Issues:
- **Users not persisting**: Check if IndexedDB is enabled in your browser
- **Multiple tabs out of sync**: This is expected behavior for IndexedDB

This setup allows you to develop the full multi-user experience locally while having the option to test with real authentication services when needed.