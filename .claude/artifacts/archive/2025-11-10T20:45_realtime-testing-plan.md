---
title: Realtime Multi-Session Testing Plan
created: 2025-11-10T20:45
status: Testing Strategy
priority: CRITICAL
---

# Realtime Multi-Session Testing Plan

## Objective

Understand why the same user cannot load the app in multiple browsers/tabs and determine if it's:
1. Supabase connection limits
2. Session management issues
3. RealtimeManager singleton problems
4. WebSocket connection conflicts

---

## Phase 1: Add Comprehensive Logging

### 1.1 Enhance RealtimeManager with Debug Logging

**File:** `src/services/data/RealtimeManager.ts`

**Add at top of class:**
```typescript
export class RealtimeManager extends EventEmitter {
  // Existing fields...

  // NEW: Connection tracking
  private connectionId: string = crypto.randomUUID()
  private connectionStartTime: number = 0
  private connectionMetrics = {
    subscriptionAttempts: 0,
    subscriptionSuccesses: 0,
    subscriptionFailures: 0,
    messagesReceived: 0,
    lastMessageTime: 0
  }

  constructor() {
    super()
    console.log(`
┌─────────────────────────────────────────────────────────────┐
│ 🔌 RealtimeManager Instance Created                         │
│ Connection ID: ${this.connectionId.substring(0, 8)}...       │
│ Timestamp: ${new Date().toISOString()}                       │
└─────────────────────────────────────────────────────────────┘
    `)
    this.logEnvironmentInfo()
  }

  private logEnvironmentInfo(): void {
    console.log('[RealtimeManager] Environment:', {
      userAgent: navigator.userAgent,
      connectionType: (navigator as any).connection?.effectiveType || 'unknown',
      online: navigator.onLine,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      timestamp: Date.now()
    })
  }

  async subscribeToUserBands(userId: string, bandIds: string[]): Promise<void> {
    this.connectionMetrics.subscriptionAttempts++

    console.log(`
┌─────────────────────────────────────────────────────────────┐
│ 📡 Subscribing to User Bands                                 │
│ Connection ID: ${this.connectionId.substring(0, 8)}...       │
│ User ID: ${userId.substring(0, 8)}...                        │
│ Band Count: ${bandIds.length}                                │
│ Band IDs: ${bandIds.map(id => id.substring(0, 8)).join(', ')} │
│ Attempt #: ${this.connectionMetrics.subscriptionAttempts}    │
└─────────────────────────────────────────────────────────────┘
    `)

    this.connectionStartTime = Date.now()

    try {
      // Existing subscription logic...

      this.connectionMetrics.subscriptionSuccesses++
      const elapsed = Date.now() - this.connectionStartTime

      console.log(`
✅ Subscription Successful
   Connection ID: ${this.connectionId.substring(0, 8)}...
   Time elapsed: ${elapsed}ms
   Total subscriptions: ${this.connectionMetrics.subscriptionSuccesses}
      `)
    } catch (error) {
      this.connectionMetrics.subscriptionFailures++

      console.error(`
❌ Subscription Failed
   Connection ID: ${this.connectionId.substring(0, 8)}...
   Error: ${error}
   Failures: ${this.connectionMetrics.subscriptionFailures}
      `)
      throw error
    }
  }

  // Add message tracking
  private handleRealtimeMessage(payload: any): void {
    this.connectionMetrics.messagesReceived++
    this.connectionMetrics.lastMessageTime = Date.now()

    console.log(`[RealtimeManager] Message received:`, {
      connectionId: this.connectionId.substring(0, 8),
      messageCount: this.connectionMetrics.messagesReceived,
      timeSinceStart: Date.now() - this.connectionStartTime,
      payload: payload
    })

    // Existing message handling...
  }

  // Add diagnostics method
  getDiagnostics() {
    return {
      connectionId: this.connectionId,
      uptime: Date.now() - this.connectionStartTime,
      metrics: this.connectionMetrics,
      channels: this.channels.size,
      isOnline: navigator.onLine
    }
  }
}
```

### 1.2 Add Logging to AuthContext

**File:** `src/contexts/AuthContext.tsx`

**Add before RealtimeManager creation:**
```typescript
// In the session handling effect:
console.log(`
┌─────────────────────────────────────────────────────────────┐
│ 🔐 Auth Session Established                                  │
│ User ID: ${userId.substring(0, 8)}...                        │
│ Tab ID: ${sessionStorage.getItem('tabId')}                   │
│ Session ID: ${session.accessToken.substring(0, 12)}...       │
│ Bands: ${bands.length}                                       │
└─────────────────────────────────────────────────────────────┘
`)

// Add unique tab identifier
if (!sessionStorage.getItem('tabId')) {
  sessionStorage.setItem('tabId', crypto.randomUUID())
}
```

### 1.3 Add Browser Storage Inspection

**Create utility:** `src/utils/debugRealtime.ts`
```typescript
export function inspectRealtimeState() {
  console.log('
═══════════════════════════════════════════════════════════
🔍 REALTIME DEBUG INSPECTION
═══════════════════════════════════════════════════════════
')

  // Check localStorage
  console.log('📦 localStorage:', {
    authToken: localStorage.getItem('sb-khzeuxxhigqcmrytsfux-auth-token') ? 'EXISTS' : 'MISSING',
    keys: Object.keys(localStorage)
  })

  // Check sessionStorage
  console.log('📦 sessionStorage:', {
    tabId: sessionStorage.getItem('tabId'),
    keys: Object.keys(sessionStorage)
  })

  // Check IndexedDB connections
  indexedDB.databases().then(dbs => {
    console.log('💾 IndexedDB:', dbs.map(db => db.name))
  })

  // Check active WebSocket connections (approximation)
  console.log('🌐 Navigator:', {
    online: navigator.onLine,
    connection: (navigator as any).connection?.effectiveType,
    userAgent: navigator.userAgent.substring(0, 50) + '...'
  })

  console.log('═══════════════════════════════════════════════════════════')
}

// Auto-run on load in dev mode
if (import.meta.env.DEV) {
  window.debugRealtime = inspectRealtimeState
  console.log('💡 Debug tool available: debugRealtime()')
}
```

---

## Phase 2: Manual Testing Procedure

### 2.1 Test Setup

**Environment:**
- Local Supabase running: `supabase start`
- Dev server running: `npm run dev`
- Two different browsers OR incognito + normal mode
- Chrome DevTools open in both

**Prepare Test User:**
```bash
# Use existing seed user
Email: eric@ipodshuffle.com
Password: test123
```

---

### 2.2 Test Scenario 1: Sequential Browser Login

**Objective:** Can the same user log in from two browsers?

**Steps:**

1. **Browser A (Chrome):**
   ```
   ✓ Open http://localhost:5173
   ✓ Open DevTools Console
   ✓ Login as eric@ipodshuffle.com
   ✓ Wait for "RealtimeManager Instance Created" log
   ✓ Note the Connection ID
   ✓ Navigate to /songs
   ✓ Keep this tab open
   ```

2. **Browser B (Firefox/Incognito):**
   ```
   ✓ Open http://localhost:5173 in new browser
   ✓ Open DevTools Console
   ✓ Login as eric@ipodshuffle.com (SAME USER)
   ✓ Watch console carefully
   ```

**Expected Behavior:**
- Both browsers should connect successfully
- Each should have unique Connection ID
- Both should show "Subscription Successful"

**Failure Patterns to Watch For:**
- Infinite loading spinner
- Connection timeout errors
- "WebSocket connection failed"
- Supabase auth errors
- React component errors

**Document:**
```
Browser A Connection ID: ________________
Browser B Connection ID: ________________
Browser A Status: [ ] Success [ ] Failed
Browser B Status: [ ] Success [ ] Failed
Error Messages (if any):
_________________________________________
_________________________________________
```

---

### 2.3 Test Scenario 2: Realtime Message Delivery

**Objective:** Do both browsers receive realtime updates?

**Prerequisites:** Both browsers successfully logged in from Scenario 1

**Steps:**

1. **Browser A:**
   ```
   ✓ Navigate to /songs
   ✓ Click "Add Song"
   ✓ Fill out form:
      Title: "Test Song A"
      Artist: "Test Artist"
   ✓ Click Save
   ✓ Observe console for sync messages
   ```

2. **Browser B:**
   ```
   ✓ Already on /songs page
   ✓ Watch console for "Message received" logs
   ✓ Check if "Test Song A" appears automatically
   ```

**Expected Behavior:**
- Browser B console shows: `[RealtimeManager] Message received`
- Browser B UI updates to show "Test Song A" without refresh
- Both browsers show identical song list

**Document:**
```
Message received in Browser B: [ ] YES [ ] NO
Time to appear: _____________ ms
UI updated: [ ] YES [ ] NO
```

---

### 2.4 Test Scenario 3: Connection Metrics

**Objective:** Understand Supabase connection behavior

**Steps:**

1. **In ANY browser console, run:**
   ```javascript
   // Access the RealtimeManager instance
   const authContext = document.querySelector('[data-auth-context]') // Need to add this
   // OR use the debug utility
   window.debugRealtime()
   ```

2. **Check Supabase Dashboard:**
   ```
   ✓ Go to: https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux/logs
   ✓ Check "Realtime" tab
   ✓ Look for active connections count
   ✓ Check for rate limiting errors
   ```

**Document:**
```
Active Connections (Supabase): _________
Expected Connections: _________
Connection Rate Limit: _________
Error Logs: [ ] None [ ] See below
_________________________________________
```

---

### 2.5 Test Scenario 4: Third Browser/Tab

**Objective:** Stress test connection limits

**Steps:**

1. **Keep Browsers A & B open**
2. **Open Browser C (another tab in Chrome):**
   ```
   ✓ Open http://localhost:5173
   ✓ Login as eric@ipodshuffle.com
   ✓ Observe console
   ```

**Expected Behavior:**
- Either succeeds (supports 3+ connections)
- OR fails gracefully with clear error message

**Document:**
```
Browser C Status: [ ] Success [ ] Failed
Error Message: _____________________________
Connection Count Limit: _________
```

---

## Phase 3: Playwright Automated Tests

### 3.1 Multi-Context Test Setup

**File:** `tests/e2e/realtime/multi-session.spec.ts`

```typescript
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

test.describe('Realtime Multi-Session Tests', () => {
  let browser: Browser;
  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let pageA: Page;
  let pageB: Page;

  const TEST_USER = {
    email: 'eric@ipodshuffle.com',
    password: 'test123'
  };

  test.beforeAll(async ({ browser: browserInstance }) => {
    browser = browserInstance;
  });

  test.beforeEach(async () => {
    // Create two independent browser contexts (simulates different browsers)
    contextA = await browser.newContext({
      // Unique session for Context A
      storageState: undefined,
      viewport: { width: 1280, height: 720 }
    });

    contextB = await browser.newContext({
      // Unique session for Context B
      storageState: undefined,
      viewport: { width: 1280, height: 720 }
    });

    pageA = await contextA.newPage();
    pageB = await contextB.newPage();

    // Enable console logging for debugging
    pageA.on('console', msg => console.log(`[Browser A] ${msg.text()}`));
    pageB.on('console', msg => console.log(`[Browser B] ${msg.text()}`));
  });

  test.afterEach(async () => {
    await contextA.close();
    await contextB.close();
  });

  test('same user can login from two different contexts', async () => {
    // Browser A: Login
    await pageA.goto('/auth');
    await pageA.fill('[data-testid="login-email-input"]', TEST_USER.email);
    await pageA.fill('[data-testid="login-password-input"]', TEST_USER.password);
    await pageA.click('[data-testid="login-submit-button"]');

    // Wait for successful login (redirect to songs page)
    await pageA.waitForURL(/\/songs/, { timeout: 10000 });
    console.log('✓ Browser A logged in successfully');

    // Browser B: Login (SAME USER)
    await pageB.goto('/auth');
    await pageB.fill('[data-testid="login-email-input"]', TEST_USER.email);
    await pageB.fill('[data-testid="login-password-input"]', TEST_USER.password);
    await pageB.click('[data-testid="login-submit-button"]');

    // This should ALSO succeed
    await pageB.waitForURL(/\/songs/, { timeout: 10000 });
    console.log('✓ Browser B logged in successfully');

    // Verify both contexts are showing the songs page
    expect(pageA.url()).toContain('/songs');
    expect(pageB.url()).toContain('/songs');
  });

  test('realtime updates propagate between contexts', async () => {
    // Setup: Both browsers logged in
    await loginBothContexts(pageA, pageB, TEST_USER);

    // Browser A: Create a song
    const songTitle = `Test Song ${Date.now()}`;

    await pageA.click('[data-testid="add-song-button"]');
    await pageA.fill('[data-testid="song-title-input"]', songTitle);
    await pageA.fill('[data-testid="song-artist-input"]', 'Test Artist');
    await pageA.click('[data-testid="save-song-button"]');

    console.log(`✓ Browser A created song: ${songTitle}`);

    // Browser B: Should see the song appear (realtime update)
    // Wait for realtime propagation (with timeout)
    await expect(pageB.locator(`text=${songTitle}`)).toBeVisible({ timeout: 5000 });

    console.log('✓ Browser B received realtime update');
  });

  test('connection diagnostics are available', async () => {
    await loginBothContexts(pageA, pageB, TEST_USER);

    // Check connection state in Browser A
    const diagnosticsA = await pageA.evaluate(() => {
      // Access RealtimeManager diagnostics
      return (window as any).realtimeManager?.getDiagnostics();
    });

    expect(diagnosticsA).toBeDefined();
    expect(diagnosticsA.connectionId).toBeDefined();
    console.log('Browser A Diagnostics:', diagnosticsA);

    // Check connection state in Browser B
    const diagnosticsB = await pageB.evaluate(() => {
      return (window as any).realtimeManager?.getDiagnostics();
    });

    expect(diagnosticsB).toBeDefined();
    expect(diagnosticsB.connectionId).toBeDefined();
    console.log('Browser B Diagnostics:', diagnosticsB);

    // Verify they have different connection IDs
    expect(diagnosticsA.connectionId).not.toBe(diagnosticsB.connectionId);
  });

  test('handles connection failure gracefully', async () => {
    await loginBothContexts(pageA, pageB, TEST_USER);

    // Simulate network failure in Browser A
    await pageA.context().setOffline(true);

    // Wait a moment
    await pageA.waitForTimeout(2000);

    // Check for offline indicator or error message
    const offlineIndicator = await pageA.locator('[data-testid="connection-status"]').textContent();
    expect(offlineIndicator).toContain('Offline');

    // Restore network
    await pageA.context().setOffline(false);

    // Should reconnect automatically
    await expect(pageA.locator('[data-testid="connection-status"]')).not.toBeVisible({ timeout: 10000 });
  });

  test('three simultaneous sessions work', async () => {
    // Create third context
    const contextC = await browser.newContext();
    const pageC = await contextC.newPage();
    pageC.on('console', msg => console.log(`[Browser C] ${msg.text()}`));

    try {
      // Login from all three contexts
      await loginBothContexts(pageA, pageB, TEST_USER);

      await pageC.goto('/auth');
      await pageC.fill('[data-testid="login-email-input"]', TEST_USER.email);
      await pageC.fill('[data-testid="login-password-input"]', TEST_USER.password);
      await pageC.click('[data-testid="login-submit-button"]');

      await pageC.waitForURL(/\/songs/, { timeout: 10000 });
      console.log('✓ Browser C logged in successfully');

      // Verify all three can see content
      expect(pageA.url()).toContain('/songs');
      expect(pageB.url()).toContain('/songs');
      expect(pageC.url()).toContain('/songs');

      console.log('✓ Three simultaneous sessions working');
    } finally {
      await contextC.close();
    }
  });
});

// Helper function
async function loginBothContexts(pageA: Page, pageB: Page, user: { email: string; password: string }) {
  // Login Browser A
  await pageA.goto('/auth');
  await pageA.fill('[data-testid="login-email-input"]', user.email);
  await pageA.fill('[data-testid="login-password-input"]', user.password);
  await pageA.click('[data-testid="login-submit-button"]');
  await pageA.waitForURL(/\/songs/, { timeout: 10000 });

  // Login Browser B
  await pageB.goto('/auth');
  await pageB.fill('[data-testid="login-email-input"]', user.email);
  await pageB.fill('[data-testid="login-password-input"]', user.password);
  await pageB.click('[data-testid="login-submit-button"]');
  await pageB.waitForURL(/\/songs/, { timeout: 10000 });
}
```

### 3.2 Add to Playwright Config

**File:** `playwright.config.ts`

```typescript
export default defineConfig({
  // ... existing config ...

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // Add new project specifically for multi-session tests
    {
      name: 'multi-session',
      testMatch: '**/realtime/multi-session.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Allow multiple contexts
        launchOptions: {
          args: ['--disable-web-security'] // May help with debugging
        }
      }
    }
  ],
});
```

---

## Phase 4: Supabase Dashboard Monitoring

### 4.1 Real-Time Metrics to Check

**Dashboard URL:** `https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux`

**Check these tabs:**

1. **Realtime (Left sidebar):**
   - Active connections count
   - Messages per second
   - Connection errors

2. **Logs:**
   - Filter by: "Realtime"
   - Look for:
     - Connection timeouts
     - Rate limit errors
     - Authentication failures

3. **Database (Postgres Logs):**
   - Check for connection pool exhaustion
   - Look for: `too many connections`

4. **Settings → API:**
   - Check connection limits for your plan
   - Free tier: Usually 2-4 concurrent connections
   - Pro tier: Usually 200+ concurrent connections

---

## Phase 5: Results Analysis

### 5.1 Diagnosis Matrix

| Symptom | Likely Cause | Next Steps |
|---------|--------------|------------|
| Browser B fails to load (infinite spinner) | Supabase connection limit hit | Check dashboard, upgrade plan |
| Browser B loads but no realtime updates | WebSocket not established | Check console for errors, verify channel subscription |
| Browser B shows auth error | Session conflict | Investigate session storage, token handling |
| Both browsers work but only one gets updates | Channel subscription issue | Check RealtimeManager subscribeToUserBands logic |
| Connection works initially, then fails | Connection timeout or heartbeat issue | Implement connection health monitoring |
| Works in development, fails in production | CORS or environment config | Check Supabase project settings |

### 5.2 Expected Findings Documentation

**Create:** `tests/e2e/realtime/FINDINGS.md`

```markdown
# Multi-Session Testing Findings

## Test Date: YYYY-MM-DD

### Environment
- Supabase Plan: Free/Pro
- Local/Production: Local
- Browser: Chrome 120, Firefox 121

### Test Results

#### Scenario 1: Sequential Login
- [ ] PASS / [ ] FAIL
- Connection A ID: ________________
- Connection B ID: ________________
- Notes: _________________________

#### Scenario 2: Realtime Updates
- [ ] PASS / [ ] FAIL
- Latency: _______ ms
- Notes: _________________________

#### Scenario 3: Connection Metrics
- Active Connections: _______
- Plan Limit: _______
- Notes: _________________________

#### Scenario 4: Three Browsers
- [ ] PASS / [ ] FAIL
- Notes: _________________________

### Root Cause Analysis
[Document findings here]

### Recommended Fixes
1. [ ] Fix 1
2. [ ] Fix 2
3. [ ] Fix 3
```

---

## Phase 6: Run the Tests

### 6.1 Manual Test Command Sequence

```bash
# Terminal 1: Start Supabase
supabase start

# Terminal 2: Start dev server
npm run dev

# Terminal 3: Open Supabase dashboard in background
open https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux/logs

# Follow manual testing procedure from Phase 2
# Document results in tests/e2e/realtime/FINDINGS.md
```

### 6.2 Automated Test Command

```bash
# Run multi-session tests
npm run test:e2e -- --project=multi-session

# Run with UI for debugging
npm run test:e2e:ui -- --project=multi-session

# Run with headed browser to watch
npx playwright test tests/e2e/realtime/multi-session.spec.ts --headed --project=chromium
```

---

## Success Criteria

✅ Same user can login from 2+ browsers simultaneously
✅ Each browser has unique connection ID
✅ Realtime updates propagate to all browsers within 1 second
✅ Connection survives network interruption (with reconnect)
✅ Clear error messages if connection fails
✅ Supabase dashboard shows expected connection count

---

## Timeline

- **Phase 1 (Logging):** 1-2 hours
- **Phase 2 (Manual Testing):** 30-60 minutes
- **Phase 3 (Playwright Tests):** 2-3 hours
- **Phase 4 (Analysis):** 30 minutes
- **Total:** ~4-6 hours

**Next Step:** Implement Phase 1 logging enhancements?
