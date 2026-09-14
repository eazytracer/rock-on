---
feature: Auth & Data Layer Simplification — Phase 1 implementation plan
created: 2026-09-02
status: plan-ready
kind: implementation-plan
phase: 1 (session)
branch: fix/auth-session-simplification
---

# Phase 1 Implementation Plan — Session Simplification

Locked decisions from the grill-me session (2026-09-02):

- **Q1 — Scope:** Phase 1 only. Session management collapses onto the Supabase
  SDK. The IndexedDB/Dexie data layer is **untouched** (that's Phase 2).
- **Q2 — Offline tolerance:** Lean on Supabase's persisted session. The SDK
  keeps the session in `sb-*` localStorage and auto-refreshes when online.
  **Sign out ONLY on an explicit `SIGNED_OUT` / rejected-refresh-token event —
  never on a network error.** This replaces the hand-rolled 1.5h grace with the
  refresh token's ~30-day window.
- **Q3/Q5 — Recovery ladder** for "token valid but app state broken":
  1. retry `loadUserData` once in place;
  2. redirect to home (`/`) — safe surface, renders in personal context;
  3. only then redirect to `/auth`.
     Guarded by a `sessionStorage` circuit breaker (`authRecoveryAttempts`) cleared
     on any successful load, so it can descend only once per episode.
- **Q4 — Test build:** local, on branch `fix/auth-session-simplification`, full
  stack via `npm run start:dev` (local Supabase in docker).
- **Q6 — Messaging (start here, iterate after seeing it):**
  - SIGNED_OUT (inactivity/expiry): "You've been signed out. Please sign in
    again." (info)
  - Offline, session still valid: non-blocking "Offline — changes will sync when
    you reconnect." (no redirect)
  - Genuine session error/corruption: "There was a problem with your session.
    Please sign in again." (distinct)

Execution: planned on Opus; implemented by **Sonnet subagents** (delegation
pinned to `claude-sonnet-4-5`).

---

## Target architecture

**Single source of truth = the Supabase SDK session.** Cache auth tokens only
(the SDK's own `sb-*` keys). No parallel mirror, no time-math, no polling.

Auth state flows reactively from `supabase.auth.onAuthStateChange`:

- `SIGNED_IN` → load user data, populate context.
- `TOKEN_REFRESHED` → update in-memory session silently.
- `SIGNED_OUT` → clear state, redirect with the inactivity message.

The route guard asks the SDK "is there a session?" via `getSession()` (fast,
reads localStorage, no network when token valid) rather than trusting a mirror.

---

## ⚠️ Empirical unknown to verify FIRST (before the refactor)

Supabase `getSession()` offline behavior must be confirmed against the local
stack, because Q2's whole design rests on it:

- Does `getSession()` return the persisted session object when **offline with an
  expired access token but a still-valid refresh token**, or null?
- Does a failed refresh while offline emit `SIGNED_OUT`, or stay silent and
  retry?

**Verification task (Task 0):** with local Supabase up, sign in, then in devtools
simulate offline + fast-forward past access-token expiry (or set a short JWT
expiry in local config) and observe `getSession()` return value +
`onAuthStateChange` events. Record findings in this doc before Task 1 finalizes
the guard's "offline = stay in" branch. If `getSession()` returns null offline,
the guard must additionally consult the last known session held in AuthContext
state (in-memory) rather than treating null as signed-out.

---

## Work breakdown (sequential — the core files are tightly coupled)

### Task 0 — Verify Supabase offline session semantics (Sonnet, small)

Confirm the unknowns above; write findings into this plan's "Findings" section.
Gate Task 1's offline branch on the result.

### Task 1 — Core session refactor (Sonnet, source + coupled unit tests)

Single cohesive change (these files interlock; do NOT parallelize):

- **DELETE** `src/services/auth/SessionManager.ts` (the mirror). Remove all
  imports/uses.
- **`src/hooks/useAuthCheck.ts`** — rewrite:
  - Authority = `await supabase.auth.getSession()` (via the auth service, not a
    direct client import — keep the `IAuthService` seam). Authenticated ⇔ a
    session is present (per Task 0's offline rule) AND `currentUserId` resolvable.
  - Remove `GRACE_PERIOD_HOURS`, the `expiresAt` math, and the dead grace branch.
  - Distinguish failure reasons for messaging: `signed-out` (clean null /
    SIGNED_OUT) vs `session-error` (getSession threw). Drop the misleading
    `session-invalid` default.
  - Keep exactly ONE cross-tab `storage` listener (remove the duplicate; see
    AuthContext below).
- **`src/contexts/AuthContext.tsx`** — remove the parallel session machinery:
  - Delete the 30s `setInterval` session poll (`~:110-171`) and the
    `SessionManager`-based `checkSession`.
  - Keep the `visibilitychange` hook ONLY to trigger a proactive
    `refreshSession()` when the tab refocuses near expiry (not to run mirror
    math).
  - Reconcile the two `storage` listeners into one (AuthContext owns cross-tab
    sign-in/out; useAuthCheck just reacts to an `auth-changed` signal). Decide
    whether the custom `auth-logout` event survives or is replaced by reacting to
    SIGNED_OUT directly — prefer reacting to the SDK event; keep a single
    same-tab notification path.
  - **Realtime token:** source from `supabase.auth.getSession()` /
    `newSession.accessToken`, NOT `SessionManager.loadSession()` (`~:296-298`).
  - `loadUserData` (`~:481-611`) — stop swallowing errors silently; surface a
    failure signal the guard/recovery ladder can read (e.g. set a
    `contextLoadError` state or rethrow to a caught boundary).
- **`src/components/layout/ProtectedLayoutRoute.tsx`** — new invariant + ladder:
  - Render a protected page ONLY when authenticated AND context loaded
    (`currentUser` present). Never render with null context.
  - Implement the retry → home → auth ladder with the `sessionStorage`
    circuit breaker; clear the counter on a successful load.
  - Wire the three-state messaging reasons.
- **`src/services/auth/SupabaseAuthService.ts`** — surface the event type so the
  context can tell SIGNED_OUT from TOKEN_REFRESHED (extend the
  `onAuthStateChange` callback or add a typed variant in `IAuthService`); ensure
  `refreshSession()` (already present, unused) is called on the focus/near-expiry
  path.
- **`src/pages/AuthPages.tsx`** (`~:1846-1859`) — map the new reasons to the Q6
  copy; the inactivity case must NOT say "invalid."
- **Coupled unit tests** — rewrite `tests/unit/hooks/useAuthCheck.test.tsx` (kill
  the false-green that mocks `loadSession`/`isSessionValid` independently) and
  fix `tests/unit/contexts/AuthContext.signout.test.tsx` to the new behavior.
- **Exit bar:** `npm run lint` (0 errors), `npm run type-check` (clean),
  `npm run build` (succeeds), `npm test` unit suite green.

### Task 2 — E2E + remaining test audit (Sonnet, sequential after Task 1)

Runs against the local stack.

- Audit/rewrite `tests/e2e/auth/session-expiry.spec.ts` and
  `protected-routes.spec.ts`: replace assertions on the old "invalid session"
  text (`session-expiry.spec.ts:~296-308`), the `rock_on_session` stale-key
  cleanup (`~:123`), and the `reason=session-expired` param
  (`protected-routes.spec.ts:~218`) with the new signed-out / offline /
  session-error behavior and the recovery-ladder redirects.
- Add coverage: idle expiry → inactivity message (not "invalid"); dead/rejected
  token on reload → redirect (never blank); offline-with-valid-session → stays
  in; context-load failure → recovery ladder (home, then auth), breaker prevents
  loops.
- Do NOT weaken/skip tests to pass (CLAUDE.md testing discipline).

### Task 3 — Manual test build (Eric + me)

`npm run start:dev`, walk the three messaging states + offline + recovery ladder.
Iterate on Q6 copy per Eric's reaction.

---

## Guardrails for the subagents

- Phase 1 ONLY. Do not touch `src/services/data/**`, the Dexie `db`, the sync
  engine, or the `db-direct-write` guardrail. If a change seems to require it,
  STOP and report — do not expand scope.
- Respect CLAUDE.md: repo-layer rule, `createLogger` not `console.*` for any new
  logging, date helpers, no native dialogs (`useToast`/`useConfirm`), testability
  attributes on any new interactive elements.
- Keep the `IAuthService` seam — components/hooks go through the service/context,
  not a direct `getSupabaseClient()` import, so MockAuthService still works in
  tests.
- Net LOC should DROP. If the change is adding more than it removes, reconsider.
- End every task green on lint + type-check + build; report real command output,
  never claimed success.

## Findings (Task 0 fills this in)

**Supabase SDK offline behavior (from @supabase/auth-js v2.76.1 source analysis):**

1. **`getSession()` offline with expired access token:**
   - `getSession()` → `_useSession()` → `__loadSession()` reads from localStorage (synchronous, no network)
   - If access token is expired (within `EXPIRY_MARGIN_MS`), it calls `_callRefreshToken()`
   - `_callRefreshToken()` → `_refreshAccessToken()` makes a network request with retryable() wrapper
   - **OFFLINE BEHAVIOR:** Network request fails → `isAuthRetryableFetchError()` check
   - If retryable (network error), it does NOT emit SIGNED_OUT and does NOT remove the session
   - The session stays in localStorage; `getSession()` returns `{ data: { session: null }, error }`
   - **CRITICAL:** getSession() returns NULL on a retryable refresh failure, NOT the persisted session

2. **`_recoverAndRefresh()` behavior (called on visibility change and initialization):**
   - Loads session from storage, checks validity
   - If expired and autoRefreshToken=true, attempts refresh
   - On retryable error (network): logs error, does NOT remove session, does NOT emit SIGNED_OUT
   - On non-retryable error (invalid refresh token): removes session, would eventually trigger SIGNED_OUT
3. **Auto-refresh ticker:**
   - Runs every AUTO_REFRESH_TICK_DURATION_MS when tab visible
   - On network error: swallows it, does NOT remove session
   - Session stays valid for the refresh token lifetime (~30 days)

**IMPLICATION FOR TASK 1:**

- `getSession()` returns `null` when offline with expired access token (even though the session is still in storage)
- The guard MUST distinguish between "no session exists" vs "session exists but temporarily unrefreshable"
- Solution: Check `supabase.auth.getSession()` first; if null, check in-memory AuthContext state as fallback
- Only treat as signed-out if BOTH are null OR on explicit SIGNED_OUT event
- Network errors during refresh are retryable and do NOT trigger sign-out

## Rollback

Pure branch work (`fix/auth-session-simplification`); abandon the branch to
revert. No migrations, no prod changes, no version bump until it graduates from
test build to a real release.
