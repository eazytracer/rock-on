/**
 * Phase 6 auth screens (slice 6d): sign in errors, forgot → check email →
 * set new password (through the local mail catcher), sign up → Get started,
 * Get started targets, returnTo through sign in / sign up / Google.
 * Runs at desktop (1280) and phone (390) widths.
 */
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from '@playwright/test'
import {
  createTestUser,
  createTestUserInDB,
  deleteTestUser,
  signUpViaUI,
} from '../../fixtures/auth'

const MAILPIT = 'http://127.0.0.1:54324'

/** Latest "Reset your password" link for an address, from Mailpit. */
async function resetLinkFor(
  request: APIRequestContext,
  email: string
): Promise<string> {
  let link: string | undefined
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`
        )
        const { messages } = (await res.json()) as {
          messages: { ID: string; Subject: string }[]
        }
        const msg = messages.find(m => /reset/i.test(m.Subject))
        if (!msg) return undefined
        const full = await (
          await request.get(`${MAILPIT}/api/v1/message/${msg.ID}`)
        ).json()
        link = (full.Text as string).match(
          /https?:\/\/[^\s)]+\/auth\/v1\/verify\?[^\s)]+/
        )?.[0]
        return link
      },
      { timeout: 15000 }
    )
    .toBeTruthy()
  return link!
}

/**
 * Follow the emailed verify link to where GoTrue redirects, and open the
 * reset screen with the session it put in the URL fragment. (Local GoTrue
 * may fall back to its Site URL, so only the fragment is reused.)
 */
async function openResetLink(page: Page, link: string) {
  const res = await page.request.get(link, { maxRedirects: 0 })
  const location = res.headers()['location']
  expect(location, 'verify link should redirect').toBeTruthy()
  const hash = new URL(location).hash
  expect(hash).toContain('access_token')
  await page.goto(`/auth/reset${hash}`)
}

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
] as const

for (const { name, viewport } of VIEWPORTS) {
  test.describe(`Auth screens (${name})`, () => {
    test.use({ viewport })

    let userId: string | undefined
    test.afterEach(async ({ page }) => {
      userId ??=
        (await page
          .evaluate(() => localStorage.getItem('currentUserId'))
          .catch(() => null)) ?? undefined
      if (userId) await deleteTestUser(userId)
      userId = undefined
    })

    test('wrong password shows the inline error with a reset link', async ({
      page,
    }) => {
      const user = await createTestUserInDB(createTestUser())
      userId = user.id

      await page.goto('/auth')
      await expect(page.getByTestId('sign-in-page')).toBeVisible()
      await expect(page.getByTestId('sign-in-error')).toHaveCount(0)
      await page.getByTestId('login-email-input').fill(user.email)
      await page.getByTestId('login-password-input').fill('not-the-password')
      await page.getByTestId('sign-in-button').click()

      const err = page.getByTestId('sign-in-error')
      await expect(err).toHaveText(
        "That email and password don't match. Check for typos, or reset your password."
      )
      await expect(page.getByTestId('login-password-input')).toHaveAttribute(
        'aria-invalid',
        'true'
      )
      await expect(page).toHaveURL(/\/auth$/)

      // The reset link carries the email to Forgot password.
      await page.getByTestId('sign-in-error-reset-link').click()
      await expect(page).toHaveURL(/\/auth\/forgot/)
      await expect(page.getByTestId('forgot-email-input')).toHaveValue(
        user.email
      )
    })

    test('forgot → check your email → reset link → set new password → signed in', async ({
      page,
      request,
    }) => {
      const user = await createTestUserInDB(createTestUser())
      userId = user.id
      const newPassword = 'BrandNewPass123'

      await page.goto('/auth')
      await page.getByTestId('forgot-password-link').click()
      await expect(page.getByTestId('forgot-password-page')).toBeVisible()
      await page.getByTestId('forgot-email-input').fill(user.email)
      await page.getByTestId('forgot-submit-button').click()

      // Check your email: address, Resend countdown, no Open Mail.
      await expect(page.getByTestId('check-email-page')).toBeVisible()
      await expect(page.getByTestId('check-email-address')).toHaveText(
        user.email
      )
      const resend = page.getByTestId('check-email-resend-button')
      await expect(resend).toBeDisabled()
      await expect(resend).toHaveText(/Resend in 0:\d\d/)
      await expect(page.getByText(/open mail/i)).toHaveCount(0)
      await expect(
        page.getByTestId('check-email-different-button')
      ).toBeVisible()

      const link = await resetLinkFor(request, user.email)
      await openResetLink(page, link)

      await expect(page.getByTestId('reset-password-input')).toBeVisible({
        timeout: 10000,
      })
      // Under 8 is refused inline.
      await page.getByTestId('reset-password-input').fill('short')
      await page.getByTestId('reset-save-button').click()
      await expect(page.getByTestId('reset-error')).toContainText('8')

      await page.getByTestId('reset-password-input').fill(newPassword)
      await page.getByTestId('reset-save-button').click()
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 })
      await expect(page.getByTestId('home-page')).toBeVisible({
        timeout: 10000,
      })

      // The new password works.
      await page.evaluate(() => localStorage.clear())
      await page.goto('/auth')
      await page.getByTestId('login-email-input').fill(user.email)
      await page.getByTestId('login-password-input').fill(newPassword)
      await page.getByTestId('sign-in-button').click()
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 10000 })
    })

    test('a dead reset link says it expired and offers a new one', async ({
      page,
    }) => {
      await page.goto(
        '/auth/reset#error=access_denied&error_code=otp_expired&error_description=expired'
      )
      await expect(page.getByTestId('reset-new-link-button')).toBeVisible()
      await page.getByTestId('reset-new-link-button').click()
      await expect(page).toHaveURL(/\/auth\/forgot/)
    })

    test('sign up → Get started shows the four rows in order', async ({
      page,
    }) => {
      const user = createTestUser()
      await page.goto('/auth')
      await page.getByTestId('create-account-link').click()
      await expect(page).toHaveURL(/\/auth\/signup/)
      await expect(page.locator('input[type="password"]')).toHaveCount(1)

      // Under 8 is refused before the server.
      await page.getByTestId('signup-name-input').fill(user.name)
      await page.getByTestId('signup-email-input').fill(user.email)
      await page.getByTestId('signup-password-input').fill('short')
      await page.getByTestId('signup-submit-button').click()
      await expect(page.getByTestId('sign-up-error')).toContainText('8')

      await page.getByTestId('signup-password-input').fill(user.password)
      await page.getByTestId('signup-submit-button').click()
      await expect(page).toHaveURL(/\/get-started$/, { timeout: 10000 })

      const page_ = page.getByTestId('get-started-page')
      await expect(page_).toBeVisible()
      const rows = page_.locator('button')
      await expect(rows).toHaveText([
        /Create a band.*Just a name\. Invite people after\./,
        /Join a band.*Use a code or link/,
        /Got a jam code\?.*Jump straight into a jam or event\./,
        /Continue solo/,
      ])
      await expect(page.getByTestId('auth-lede')).toContainText(
        name === 'phone'
          ? 'later from the header or More.'
          : 'later from the sidebar.',
        { useInnerText: true }
      )
    })

    test('Get started rows go to their screens', async ({ page }) => {
      await signUpViaUI(page, createTestUser())
      await expect(page).toHaveURL(/\/get-started$/)

      for (const [testId, url] of [
        ['get-started-create-band', /\/band\/new$/],
        ['get-started-join-band', /\/j$/],
        ['get-started-jam-code', /\/get-started\/jam$/],
        ['personal-account-button', /\/$/],
      ] as const) {
        await page.goto('/get-started')
        await page.getByTestId(testId).click()
        await expect(page).toHaveURL(url)
      }
    })

    test('jam code: a bad code says so inline and stays put', async ({
      page,
    }) => {
      await signUpViaUI(page, createTestUser())
      await page.getByTestId('get-started-jam-code').click()
      await page.getByTestId('join-event-code-input').fill('ZZZZ0000')
      await page.getByTestId('join-event-button').click()
      await expect(page.getByTestId('jam-code-error')).toHaveText(
        /That code isn't valid/i
      )
      await expect(page).toHaveURL(/\/get-started\/jam$/)
    })

    test('returnTo survives sign in from a protected link', async ({
      page,
    }) => {
      const user = await createTestUserInDB(createTestUser())
      userId = user.id

      await page.goto('/calendar')
      await expect(page).toHaveURL(/\/auth\?.*returnTo=%2Fcalendar/)
      await page.getByTestId('login-email-input').fill(user.email)
      await page.getByTestId('login-password-input').fill(user.password)
      await page.getByTestId('sign-in-button').click()
      await expect(page).toHaveURL(/\/calendar/, { timeout: 10000 })
    })

    test('returnTo survives Create an account', async ({ page }) => {
      await page.goto('/auth?returnTo=%2Fcalendar')
      await page.getByTestId('create-account-link').click()
      await expect(page).toHaveURL(/\/auth\/signup\?returnTo=%2Fcalendar/)
      const user = createTestUser()
      await page.getByTestId('signup-name-input').fill(user.name)
      await page.getByTestId('signup-email-input').fill(user.email)
      await page.getByTestId('signup-password-input').fill(user.password)
      await page.getByTestId('signup-submit-button').click()
      await expect(page).toHaveURL(/\/calendar/, { timeout: 10000 })
    })

    test('Google sign-in carries returnTo to the callback', async ({
      page,
    }) => {
      let authorizeUrl: string | undefined
      await page.route('**/auth/v1/authorize**', route => {
        authorizeUrl = route.request().url()
        return route.abort()
      })
      await page.goto('/auth?returnTo=%2Fj%2FABC123')
      await page.getByTestId('auth-google-button').click()
      await expect.poll(() => authorizeUrl).toBeTruthy()
      const url = new URL(authorizeUrl!)
      expect(url.searchParams.get('provider')).toBe('google')
      const redirect = new URL(url.searchParams.get('redirect_to')!)
      expect(redirect.pathname).toBe('/auth/callback')
      expect(redirect.searchParams.get('returnTo')).toBe('/j/ABC123')
    })

    test('a cancelled Google sign-in is said inline', async ({ page }) => {
      await page.goto('/auth?error=access_denied')
      await expect(page.getByTestId('sign-in-error')).toContainText(
        /cancelled/i
      )
    })
  })
}
