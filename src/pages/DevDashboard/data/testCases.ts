/**
 * Test Case Data
 *
 * Compiled from .claude/specifications/user-flows/authentication-test-status.md
 */

export interface TestCase {
  id: string
  name: string
  status:
    | 'PASS'
    | 'FAIL'
    | 'PARTIAL'
    | 'NOT_IMPLEMENTED'
    | 'IN_PROGRESS'
    | 'SKIPPED'
  file?: string
  notes?: string
}

export interface TestCategory {
  name: string
  tests: TestCase[]
}

export const testCaseData = {
  summary: {
    total: 46,
    passing: 2,
    failing: 0,
    notImplemented: 44,
  },

  categories: [
    {
      name: 'Sign Up (Email/Password)',
      tests: [
        {
          id: 'TC-001',
          name: 'Valid email/password creates account',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-002',
          name: 'Duplicate email shows error',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-003',
          name: 'Weak password shows error',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-004',
          name: 'Mismatched passwords show error',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-005',
          name: 'New user redirected to get-started',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-006',
          name: 'User record created in Supabase',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-007',
          name: 'User synced to IndexedDB',
          status: 'NOT_IMPLEMENTED',
        },
      ],
    },
    {
      name: 'Sign In (Email/Password)',
      tests: [
        {
          id: 'TC-008',
          name: 'Valid credentials sign in successfully',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-009',
          name: 'Invalid password shows error',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-010',
          name: 'User with band redirected to home',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-011',
          name: 'User without band redirected to get-started',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-012',
          name: 'Session persists on page refresh',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-013',
          name: 'Session persists across tabs',
          status: 'PARTIAL',
          file: 'tests/journeys/auth-journeys.test.ts',
          notes: 'Skeleton exists, needs implementation',
        },
      ],
    },
    {
      name: 'Google OAuth',
      tests: [
        {
          id: 'TC-014',
          name: 'Google sign in initiates OAuth flow',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-015',
          name: 'OAuth callback creates session',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-016',
          name: 'New Google user redirected to get-started',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-017',
          name: 'Returning Google user redirected to home',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-018',
          name: "User record has authProvider='google'",
          status: 'NOT_IMPLEMENTED',
        },
      ],
    },
    {
      name: 'Band Creation',
      tests: [
        {
          id: 'TC-019',
          name: 'Create band form validates input',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-020',
          name: 'Band created in Supabase',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-021',
          name: 'Band synced to IndexedDB',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-022',
          name: "Membership created with role='admin'",
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-023',
          name: 'Membership synced to IndexedDB',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-024',
          name: 'localStorage.currentBandId set',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-025',
          name: 'User redirected to home after creation',
          status: 'NOT_IMPLEMENTED',
        },
      ],
    },
    {
      name: 'Band Joining',
      tests: [
        {
          id: 'TC-026',
          name: 'Invalid invite code shows error',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-027',
          name: 'Valid invite code creates membership',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-028',
          name: "Membership has role='member'",
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-029',
          name: 'Band data synced to IndexedDB',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-030',
          name: 'Band songs synced to IndexedDB',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-031',
          name: 'localStorage.currentBandId set',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-032',
          name: 'User redirected to home after joining',
          status: 'NOT_IMPLEMENTED',
        },
      ],
    },
    {
      name: 'Session Management',
      tests: [
        {
          id: 'TC-033',
          name: 'Session expires after 1 hour',
          status: 'PARTIAL',
          file: 'tests/journeys/auth-journeys.test.ts',
          notes: 'Skeleton exists, needs implementation',
        },
        {
          id: 'TC-034',
          name: 'Session expiry shows re-auth prompt',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-035',
          name: 'Local data accessible after expiry (read-only)',
          status: 'PARTIAL',
          file: 'tests/journeys/auth-journeys.test.ts',
          notes: 'Partially covered in existing tests',
        },
        {
          id: 'TC-036',
          name: 'Re-auth restores full functionality',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-037',
          name: 'Pending changes sync after re-auth',
          status: 'NOT_IMPLEMENTED',
        },
      ],
    },
    {
      name: 'Sign Out',
      tests: [
        {
          id: 'TC-038',
          name: 'Sign out clears session',
          status: 'PASS',
          file: 'tests/unit/services/auth/SupabaseAuthService.logout.test.ts',
          notes: 'Passing',
        },
        {
          id: 'TC-039',
          name: 'Sign out clears localStorage auth tokens',
          status: 'PASS',
          file: 'tests/unit/services/auth/SupabaseAuthService.logout.test.ts',
          notes: 'Passing',
        },
        {
          id: 'TC-040',
          name: 'Sign out preserves IndexedDB data',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-041',
          name: 'Sign out redirects to /auth',
          status: 'NOT_IMPLEMENTED',
          notes: 'UI test',
        },
        {
          id: 'TC-042',
          name: 'Sign out syncs across all tabs',
          status: 'PARTIAL',
          file: 'tests/journeys/auth-journeys.test.ts',
          notes: 'Skeleton exists, needs implementation',
        },
      ],
    },
    {
      name: 'Error Handling',
      tests: [
        {
          id: 'TC-043',
          name: 'Network error shows clear message',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-044',
          name: 'Network error allows retry',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-045',
          name: 'OAuth error redirects to sign in',
          status: 'NOT_IMPLEMENTED',
        },
        {
          id: 'TC-046',
          name: 'No data loss on auth errors',
          status: 'PARTIAL',
          file: 'tests/journeys/auth-journeys.test.ts',
          notes: 'Partially covered',
        },
      ],
    },
  ] as TestCategory[],
}
