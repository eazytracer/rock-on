# Rock On! User Management Implementation Plan
## Phased Approach for User Authentication & Authorization

### Current Application Analysis

**Existing Architecture:**
- React 18 + TypeScript + TailwindCSS frontend
- Dexie (IndexedDB) client-side database
- No current authentication system
- Static band/member data structure
- Single-band hardcoded approach (`bandId: 'band1'`)

**Key Files to Modify:**
- `src/models/Band.ts` - Band model with memberIds array
- `src/models/Member.ts` - Member model with email/role fields
- `src/database/db.ts` - Database schema (missing bands table)
- `src/App.tsx` - Application entry point (no auth protection)

---

## Phase 1: Foundation & Quick Prototype (Days 1-2)
*Goal: Get basic user accounts working with manual signup/login*

### 1.1 Authentication Infrastructure
**Priority: Critical**

#### New Components to Create:
```typescript
// src/components/auth/
├── LoginForm.tsx           // Email/password login
├── SignupForm.tsx          // New user registration
├── AuthGuard.tsx           // Route protection wrapper
└── UserProfile.tsx         // Basic profile management

// src/contexts/
└── AuthContext.tsx         // Global auth state

// src/services/
├── AuthService.ts          // Local auth logic
├── UserService.ts          // User CRUD operations
└── BandService.ts          // Band management (enhance existing)

// src/models/
├── User.ts                 // User account model
└── BandInvite.ts           // Band invitation model
```

#### Database Schema Updates:
```typescript
// Add to db.ts
users: '++id, email, name, createdDate, lastLogin',
bands: '++id, name, ownerId, createdDate, inviteCode',
bandMembers: '++id, bandId, userId, role, joinedDate, status',
bandInvites: '++id, bandId, code, createdBy, expiresAt, uses'
```

#### Authentication Flow:
1. **Local Storage JWT-style tokens** (for prototype speed)
2. **Email/username + password** stored in IndexedDB (hashed)
3. **Simple session management** in AuthContext
4. **Route protection** on all main app routes

### 1.2 User Registration & Band Creation
**Priority: Critical**

#### New User Flow:
1. User signs up with email/password
2. **Auto-create personal band** OR **join existing band via code**
3. Set up basic profile (name, primary instrument)
4. Redirect to dashboard

#### Band Owner Flow:
1. First user in band becomes admin/owner
2. Generate shareable invite code (6-8 character code)
3. Can manage band settings and member permissions

### 1.3 Basic Authorization
**Priority: High**

#### Role System (MVP):
```typescript
type UserRole = 'owner' | 'admin' | 'member' | 'viewer'

// Permissions:
owner:  full access, delete band, manage admins
admin:  manage members, edit all content, create setlists
member: edit songs, join sessions, view all data
viewer: read-only access (for shared links later)
```

#### Implementation:
- Update all existing services to check user permissions
- Add userId to all data creation operations
- Filter data based on user's band memberships

---

## Phase 2: Google OAuth Integration (Days 3-4)
*Goal: Add OAuth for seamless login experience*

### 2.1 OAuth Setup
**Priority: High**

#### Requirements:
- Google OAuth 2.0 client registration
- PKCE flow for security (client-side app)
- Fallback to email/password for non-Gmail users

#### Implementation:
```typescript
// src/services/auth/
├── GoogleAuthService.ts    // OAuth integration
├── LocalAuthService.ts     // Email/password auth
└── AuthService.ts          // Unified auth interface
```

#### OAuth Flow:
1. User clicks "Continue with Google"
2. OAuth popup/redirect to Google
3. Receive OAuth token + user profile
4. Check if user exists, create if new
5. Auto-join band if invite code in URL

### 2.2 Account Linking
**Priority: Medium**

#### Features:
- Link existing email account to Google account
- Merge accounts if email matches
- Allow switching between auth methods

---

## Phase 3: Advanced Member Management (Days 5-7)
*Goal: Full band collaboration features*

### 3.1 Band Member Management
**Priority: High**

#### Features:
```typescript
// Enhanced member management
├── Invite members via code OR email (if available)
├── Approve/reject join requests
├── Promote/demote member roles
├── Remove members (with data cleanup)
├── Transfer band ownership
└── Member activity tracking
```

#### UI Components:
```typescript
// src/components/band/
├── BandSettings.tsx        // Band configuration
├── MemberList.tsx          // Member management
├── InviteManager.tsx       // Invite code/email system
└── JoinBandForm.tsx        // Join via code
```

### 3.2 Multi-Band Support
**Priority: Medium**

#### Features:
- Users can join multiple bands
- Band switcher in header/sidebar
- Separate data contexts per band
- Band-specific preferences

---

## Phase 4: Shareable Links & Public Access (Days 7-10)
*Goal: Share setlists without requiring accounts*

### 4.1 Public Setlist Sharing
**Priority: High**

#### Features:
```typescript
// Public sharing system
├── Generate unique shareable URLs
├── Configure sharing permissions (view-only)
├── Optional password protection
├── Expiration dates for links
└── Usage analytics (views, downloads)
```

#### Implementation:
```typescript
// src/models/
└── ShareableLink.ts        // Public link model

// Database schema:
shareableLinks: '++id, entityType, entityId, token, permissions, expiresAt'
```

#### Shareable Content:
- **Setlists** (most common use case)
- **Song lists** (for practice preparation)
- **Practice session notes** (post-practice sharing)

### 4.2 Public View Components
**Priority: Medium**

#### Features:
```typescript
// src/components/public/
├── PublicSetlistView.tsx   // Clean setlist display
├── PublicSongList.tsx      // Song list for practice
└── ShareLinkGenerator.tsx  // Create/manage links
```

#### Public UI Requirements:
- Clean, minimal interface
- No authentication required
- Mobile-optimized for phone reference
- Optional "Join this band" call-to-action

---

## Security Considerations

### Data Protection
- **Local authentication:** Hash passwords with salt (bcrypt-style)
- **OAuth tokens:** Store securely, refresh appropriately
- **Shareable links:** Use cryptographically secure tokens
- **Data isolation:** Strict band-based data filtering

### Authorization Checks
```typescript
// Service layer security
const requirePermission = (action: string, user: User, band: Band) => {
  const membership = getUserBandMembership(user.id, band.id)
  return hasPermission(membership.role, action)
}

// Example usage
await songService.create(songData, {
  user: currentUser,
  band: currentBand,
  requiredPermission: 'create_song'
})
```

### Input Validation
- Sanitize all user inputs
- Validate email addresses
- Rate limiting for invite codes
- SQL injection prevention (even for IndexedDB)

---

## Database Migration Strategy

### Phase 1 Migration:
```typescript
// Auto-migration on app load
1. Check if users table exists
2. If not, run migration to add auth tables
3. Create default user for existing data
4. Convert hardcoded 'band1' to real band
```

### Data Backwards Compatibility:
- Keep existing song/session/setlist data
- Associate with default band/user
- Allow gradual migration of multi-user features

---

## API Design (Future Server Migration)

### RESTful Endpoints:
```typescript
// Authentication
POST   /auth/login
POST   /auth/signup
POST   /auth/oauth/google
POST   /auth/refresh
DELETE /auth/logout

// User Management
GET    /users/me
PUT    /users/me
GET    /users/:id/bands

// Band Management
GET    /bands
POST   /bands
GET    /bands/:id
PUT    /bands/:id
DELETE /bands/:id

// Member Management
GET    /bands/:id/members
POST   /bands/:id/members/invite
POST   /bands/:id/members/join
PUT    /bands/:id/members/:userId
DELETE /bands/:id/members/:userId

// Sharing
POST   /bands/:id/share
GET    /shared/:token
```

---

## Deployment Strategy

### Quick Prototype (Phase 1):
- Deploy to Vercel/Netlify as static site
- All data stored client-side (IndexedDB)
- No server infrastructure needed

### Production Ready (Phase 2+):
- Add backend API (Node.js/Express or similar)
- Move authentication to server
- Cloud database (PostgreSQL/MongoDB)
- Redis for session management

---

## Testing Strategy

### Unit Tests:
```typescript
// src/services/__tests__/
├── AuthService.test.ts
├── UserService.test.ts
├── BandService.test.ts
└── ShareService.test.ts
```

### Integration Tests:
```typescript
// tests/integration/
├── auth-flow.test.ts
├── band-management.test.ts
└── sharing.test.ts
```

### Manual Testing Checklist:
- [ ] User signup/login flows
- [ ] Band creation and joining
- [ ] Member role management
- [ ] Google OAuth integration
- [ ] Shareable link generation
- [ ] Public view access
- [ ] Multi-band switching
- [ ] Data migration scenarios

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | 2 days | Basic auth, band creation, member roles |
| Phase 2 | 2 days | Google OAuth, enhanced login UX |
| Phase 3 | 3 days | Advanced member management, multi-band |
| Phase 4 | 3 days | Public sharing, shareable links |

**Total: ~10 days for full implementation**
**Prototype deployment: 2 days**

---

## Success Metrics

### Phase 1 Success:
- [ ] New users can sign up and create bands
- [ ] Existing data migrates successfully
- [ ] Band members can join via invite codes
- [ ] Role-based permissions work correctly

### Full Implementation Success:
- [ ] Google OAuth seamlessly integrates
- [ ] Multiple bands per user works smoothly
- [ ] Shareable links function for public access
- [ ] No security vulnerabilities in auth system
- [ ] Performance remains excellent on mobile

This phased approach balances rapid prototyping with long-term scalability, allowing you to deploy a working user management system within 2 days while setting up the foundation for advanced features.