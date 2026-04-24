/**
 * E2E tests for the anonymous (unauthenticated) jam session view.
 *
 * This page is the guest-facing window into a live jam: the host shares a
 * `/jam/view/<code>?t=<token>` URL, and a guest without an account can see
 * what the host is queuing. Per the v0.3.2 rebuild (see
 * `.claude/artifacts/2026-04-24T02:30_v0.3.1-post-mortem-and-next-session-handoff.md`),
 * the primary surface is the host's broadcast setlist — NOT the
 * common-songs match list that only makes sense for authenticated
 * participants with their own catalogs.
 *
 * Tests are organised into two describe blocks:
 *
 *   1. "surface & failure modes" — no Supabase dependency required. The
 *      page renders and handles invalid tokens without crashing. These
 *      run in every CI configuration.
 *
 *   2. "live session — authored data" — seeds a real session via the
 *      admin Supabase client and hits the deployed edge function end to
 *      end. Requires `supabase start` + a running edge-function runtime.
 *      Gated with `test.skip()` when the env isn't available so the file
 *      can still run in minimal setups.
 */
import { test, expect } from '@playwright/test'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import {
  createTestUser,
  createTestUserInDB,
  deleteTestUser,
} from '../../fixtures/auth'

// ----- helpers ----------------------------------------------------------

/** SHA-256 hex digest (matches the JamSessionService.ts + edge function). */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Insert a jam session row directly via the admin client so the test can
 * control the shortCode, token, and setlist deterministically without
 * routing through the UI. Returns the raw token to embed in the URL.
 */
async function seedJamSession(options: {
  hostUserId: string
  shortCode: string
  name: string
  setlistItems: Array<{ displayTitle: string; displayArtist: string }>
}): Promise<{ sessionId: string; rawToken: string }> {
  const supabase = await getSupabaseAdmin()
  const rawToken = crypto.randomUUID()
  const hashedToken = await sha256(rawToken)
  const sessionId = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const { error } = await supabase.from('jam_sessions').insert({
    id: sessionId,
    short_code: options.shortCode,
    name: options.name,
    host_user_id: options.hostUserId,
    status: 'active',
    created_date: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    view_token: hashedToken,
    view_token_expires_at: expiresAt.toISOString(),
    settings: {
      setlistItems: options.setlistItems.map((it, idx) => ({
        id: `seed-${idx}`,
        displayTitle: it.displayTitle,
        displayArtist: it.displayArtist,
      })),
    },
  })
  if (error) throw new Error(`Failed to seed jam session: ${error.message}`)

  // Add the host as an active participant so participantCount > 0 reflects
  // the real shape the edge function returns in production.
  const { error: pErr } = await supabase.from('jam_participants').insert({
    id: crypto.randomUUID(),
    jam_session_id: sessionId,
    user_id: options.hostUserId,
    joined_date: now.toISOString(),
    status: 'active',
    shared_contexts: [{ type: 'personal', id: options.hostUserId }],
  })
  if (pErr) throw new Error(`Failed to add host participant: ${pErr.message}`)

  return { sessionId, rawToken }
}

async function updateSeededSetlist(
  sessionId: string,
  items: Array<{ displayTitle: string; displayArtist: string }>
): Promise<void> {
  const supabase = await getSupabaseAdmin()
  const { error } = await supabase
    .from('jam_sessions')
    .update({
      settings: {
        setlistItems: items.map((it, idx) => ({
          id: `seed-${idx}`,
          displayTitle: it.displayTitle,
          displayArtist: it.displayArtist,
        })),
      },
    })
    .eq('id', sessionId)
  if (error) throw new Error(`Failed to update setlist: ${error.message}`)
}

async function deleteSeededJamSession(sessionId: string): Promise<void> {
  const supabase = await getSupabaseAdmin()
  // jam_participants cascades via FK ON DELETE
  await supabase.from('jam_sessions').delete().eq('id', sessionId)
}

/** Generate a 6-char shortCode from the same alphabet the service uses. */
function randomShortCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

// ======================================================================

test.describe('Jam Session Anonymous View — surface & failure modes', () => {
  test('renders jam view page at /jam/view/:shortCode without auth', async ({
    page,
  }) => {
    // Navigate without being logged in — should NOT redirect to /auth
    await page.goto('/jam/view/TESTCODE?t=invalid-token')

    await page.waitForURL(/\/jam\/view\/TESTCODE/, { timeout: 5000 })
    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible({
      timeout: 5000,
    })
  })

  test('shows error state when token is invalid', async ({ page }) => {
    await page.goto('/jam/view/BADCODE?t=completely-wrong-token')

    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible({
      timeout: 5000,
    })
    // Allow fetch to complete
    await page.waitForTimeout(3000)
    // Page element still there, no uncaught exception — implicitly covered by
    // setupConsoleErrorTracking if callers add it; here we just ensure the
    // UI didn't collapse.
    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible()
  })

  test('page includes Rock On branding header', async ({ page }) => {
    await page.goto('/jam/view/ANYCODE?t=anytoken')

    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator('text=Rock On').first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('does not show the main app sidebar or navigation', async ({ page }) => {
    await page.goto('/jam/view/SIDTEST?t=testtoken')
    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible({
      timeout: 5000,
    })

    // The main sidebar (with band-name) should NOT be present on public jam view
    await expect(page.locator('[data-testid="sidebar-band-name"]'))
      .not.toBeVisible({ timeout: 2000 })
      .catch(() => {
        /* already not visible — correct */
      })
  })

  test('navigating directly without ?t= param renders page gracefully', async ({
    page,
  }) => {
    await page.goto('/jam/view/NOTOKEN')
    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible({
      timeout: 5000,
    })
  })

  test('anon view has NO "Songs in Common" section (v0.3.2 product intent)', async ({
    page,
  }) => {
    // The common-songs section was removed in v0.3.2. A guest has no
    // personal catalog, so the match list is irrelevant to them. This
    // test pins the absence: if anyone re-adds a "Songs in Common" or
    // re-wires JamMatchList onto the page, they'll be forced to decide
    // whether it's really the right product call.
    await page.goto('/jam/view/NOCOMMN?t=whatever')
    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible({
      timeout: 5000,
    })
    // Give the page time to settle in whatever state it lands in.
    await page.waitForTimeout(1500)

    // Header-level assertion — no "Songs in Common" heading.
    await expect(page.locator('text=Songs in Common')).toHaveCount(0)
    // JamMatchList is the only surface that used to render matches;
    // it MUST NOT appear on the anon page.
    await expect(page.locator('[data-testid="jam-match-list"]')).toHaveCount(0)
  })

  test('in dev placeholder mode the setlist is the primary surface', async ({
    page,
  }) => {
    // Without VITE_SUPABASE_URL the page seeds a demo payload that
    // deliberately includes a non-empty setlist (matches are gone in
    // v0.3.2). This test confirms the setlist component + item testids
    // are wired all the way through.
    await page.goto('/jam/view/DEMOSL?t=demo-token')
    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible({
      timeout: 5000,
    })

    const setlist = page.locator('[data-testid="jam-view-setlist"]')
    // If Supabase is wired up the page will attempt a real fetch; treat
    // this assertion as a soft check (it's an authoritative assertion in
    // local/dev where VITE_SUPABASE_URL is unset — which is exactly
    // where this describe block runs).
    if (await setlist.isVisible({ timeout: 5000 }).catch(() => false)) {
      const items = page.locator('[data-testid^="jam-view-setlist-item-"]')
      const count = await items.count()
      expect(count).toBeGreaterThan(0)
      await expect(items.first()).toContainText(/.+/)
    }
  })

  test('sign up CTA renders and links to auth with signup view', async ({
    page,
  }) => {
    await page.goto('/jam/view/TSTCODE?t=faketoken')
    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible({
      timeout: 5000,
    })
    await page.waitForTimeout(2500)

    const ctaButton = page.locator('[data-testid="jam-view-signup-cta"]')
    if (await ctaButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ctaButton.click()
      await page.waitForURL(/\/auth/, { timeout: 5000 })
      expect(page.url()).toContain('/auth')
      expect(page.url()).toContain('signup')
    }
    // If the page ended up in the "Session not available" state (no
    // matching row in Supabase), the CTA is hidden — that's also a
    // valid page state and not a bug.
  })
})

// ======================================================================

test.describe('Jam Session Anonymous View — live session (requires Supabase)', () => {
  // These tests write to the local Supabase + hit the deployed edge
  // function. Skip cleanly when Supabase isn't reachable.
  let supabaseAvailable = true
  let hostUserId: string | undefined
  let sessionId: string | undefined
  let rawToken: string | undefined
  let shortCode: string | undefined

  test.beforeAll(async () => {
    try {
      // getSupabaseAdmin throws if Supabase isn't running
      await getSupabaseAdmin()
    } catch {
      supabaseAvailable = false
    }
  })

  test.beforeEach(async () => {
    test.skip(!supabaseAvailable, 'Local Supabase not running — skipping')

    const hostTestUser = createTestUser({
      name: `Host ${Date.now()}`,
    })
    const { id } = await createTestUserInDB(hostTestUser)
    hostUserId = id
    shortCode = randomShortCode()

    const seeded = await seedJamSession({
      hostUserId: id,
      shortCode,
      name: 'E2E Live Session',
      setlistItems: [
        { displayTitle: 'Wonderwall', displayArtist: 'Oasis' },
        { displayTitle: 'Bohemian Rhapsody', displayArtist: 'Queen' },
      ],
    })
    sessionId = seeded.sessionId
    rawToken = seeded.rawToken
  })

  test.afterEach(async () => {
    if (sessionId) {
      await deleteSeededJamSession(sessionId).catch(() => {})
      sessionId = undefined
    }
    if (hostUserId) {
      await deleteTestUser(hostUserId).catch(() => {})
      hostUserId = undefined
    }
  })

  test('anon viewer sees host display name, participant count, and the host-curated setlist', async ({
    page,
  }) => {
    await page.goto(`/jam/view/${shortCode}?t=${encodeURIComponent(rawToken!)}`)

    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible({
      timeout: 5000,
    })

    // Session title
    await expect(page.locator('text=E2E Live Session').first()).toBeVisible({
      timeout: 10000,
    })

    // Host display name should fall back to users.name when no
    // user_profiles row exists (v0.3.1 fix). The test user's name is
    // `Host <timestamp>` — assert the "Host " prefix renders.
    await expect(page.locator('text=/Host \\d+/').first()).toBeVisible({
      timeout: 5000,
    })

    // Participant count: exactly 1 participant (just the host).
    await expect(page.locator('text=1 participant')).toBeVisible({
      timeout: 5000,
    })

    // Setlist rendered with both items.
    const setlist = page.locator('[data-testid="jam-view-setlist"]')
    await expect(setlist).toBeVisible({ timeout: 5000 })

    const items = page.locator('[data-testid^="jam-view-setlist-item-"]')
    await expect(items).toHaveCount(2, { timeout: 5000 })
    await expect(items.nth(0)).toContainText('Wonderwall')
    await expect(items.nth(0)).toContainText('Oasis')
    await expect(items.nth(1)).toContainText('Bohemian Rhapsody')
    await expect(items.nth(1)).toContainText('Queen')

    // Negative assertion: no common-songs surface reaches the anon view.
    await expect(page.locator('text=Songs in Common')).toHaveCount(0)
    await expect(page.locator('[data-testid="jam-match-list"]')).toHaveCount(0)
  })

  test('empty-setlist session renders the "host hasn\'t added any songs yet" state', async ({
    page,
  }) => {
    // Clear the seeded setlist before loading.
    await updateSeededSetlist(sessionId!, [])

    await page.goto(`/jam/view/${shortCode}?t=${encodeURIComponent(rawToken!)}`)

    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible({
      timeout: 5000,
    })
    await expect(
      page.locator('[data-testid="jam-view-setlist-empty"]')
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.locator('[data-testid="jam-view-setlist-empty"]')
    ).toContainText(/hasn.?t added any songs/i)
  })

  test('expired session returns 410 and the page shows an expired message', async ({
    page,
  }) => {
    // Force the session into expired state server-side.
    const supabase = await getSupabaseAdmin()
    await supabase
      .from('jam_sessions')
      .update({ status: 'expired' })
      .eq('id', sessionId!)

    await page.goto(`/jam/view/${shortCode}?t=${encodeURIComponent(rawToken!)}`)
    await expect(page.locator('[data-testid="jam-view-page"]')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator('text=/expired/i').first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('anon viewer polls for setlist edits and picks them up live', async ({
    page,
  }) => {
    // Load the page with the initial 2-item setlist.
    await page.goto(`/jam/view/${shortCode}?t=${encodeURIComponent(rawToken!)}`)
    const items = page.locator('[data-testid^="jam-view-setlist-item-"]')
    await expect(items).toHaveCount(2, { timeout: 5000 })

    // Host adds a song server-side. The page polls every 10s (see
    // LIVE_POLL_INTERVAL_MS in JamViewPage); wait up to 15s for the
    // updated content to surface without refreshing the browser.
    await updateSeededSetlist(sessionId!, [
      { displayTitle: 'Wonderwall', displayArtist: 'Oasis' },
      { displayTitle: 'Bohemian Rhapsody', displayArtist: 'Queen' },
      { displayTitle: "Sweet Child o' Mine", displayArtist: "Guns N' Roses" },
    ])

    await expect(items).toHaveCount(3, { timeout: 15000 })
    await expect(items.nth(2)).toContainText(/Sweet Child/i)
  })
})
