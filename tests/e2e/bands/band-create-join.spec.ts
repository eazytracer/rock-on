/**
 * Create, join, mark and Band profile (docs/redesign/13 · 6c): `/band/new`,
 * `/j` + `/j/:code`, the band mark picker, edit in place.
 */
import { test, expect } from '@playwright/test'
import { loginViaUI } from '../../fixtures/auth'
import { bandWith, newUser, openBand, PHONE } from './bandSetup'

test.describe('Create a band', () => {
  test('desktop: name + mark beside it → the band with the invite card', async ({
    page,
  }) => {
    const user = await newUser('Cara')
    await loginViaUI(page, user)
    await page.goto('/band/new')

    const create = page.getByTestId('band-new-create')
    await create.click()
    await expect(page.getByTestId('band-new-error')).toBeVisible()

    const name = `Acoustic Duo ${Date.now().toString().slice(-5)}`
    await page.getByTestId('band-new-name-input').fill(name)
    // Desktop shows the picker in the side pane.
    await page.getByTestId('band-mark-color-teal').click()
    await page.getByTestId('band-mark-lettering-stencil').click()
    await page.getByTestId('band-new-genre-covers').click()
    await create.click()

    await page.waitForURL(/\/band\?invite=new/, { timeout: 15000 })
    await expect(page.getByTestId('band-title')).toContainText(name)
    await expect(page.getByTestId('invite-card-solo')).toBeVisible()
    await expect(page.getByTestId('invite-code')).toHaveText(/^[A-Z0-9]{6,}$/)
    await expect(page.getByTestId('band-card-sub')).toHaveText(
      'Owner · 1 member'
    )
    // The sole owner gets Delete, not Leave.
    await expect(page.getByTestId('band-leave')).toHaveCount(0)
  })

  test.describe('phone', () => {
    test.use({ viewport: PHONE })

    test('works for a user with no band; picker opens as a sheet', async ({
      page,
    }) => {
      const user = await newUser('Pia')
      await loginViaUI(page, user)
      await page.goto('/band/new')
      await page.getByTestId('band-new-name-input').fill('Night Shift')
      await page.getByTestId('band-new-mark').click()
      await page.getByTestId('band-mark-kind-symbol').click()
      await page.getByTestId('band-mark-symbol-vinyl').click()
      await page.getByTestId('band-mark-save').click()
      await expect(
        page.getByTestId('band-new-mark').locator('[data-mark-kind]')
      ).toHaveAttribute('data-mark-kind', 'symbol')
      await page.getByTestId('band-new-create').click()

      await page.waitForURL(/\/band\?invite=new/, { timeout: 15000 })
      // Invite card first, then the band card.
      const card = page.getByTestId('invite-card')
      await expect(card).toBeVisible()
      const cardBox = await card.boundingBox()
      const bandBox = await page.getByTestId('band-card').boundingBox()
      expect(cardBox!.y).toBeLessThan(bandBox!.y)
      await expect(page.getByTestId('band-card-mark')).toHaveAttribute(
        'data-mark-kind',
        'symbol'
      )
    })
  })
})

test.describe('Join a band', () => {
  test('preview shows the band; Join switches into it', async ({ page }) => {
    const owner = await newUser('Jon')
    const band = await bandWith(
      owner,
      [],
      `Join Me ${Date.now().toString().slice(-5)}`
    )
    const guest = await newUser('Gina')
    await loginViaUI(page, guest)

    await page.goto('/j')
    await page
      .getByTestId('join-code-input')
      .fill(`http://localhost:5173/j/${band.code.toLowerCase()}`)
    await page.getByTestId('join-code-continue').click()
    await expect(page).toHaveURL(new RegExp(`/j/${band.code}$`))

    await expect(page.getByTestId('join-band-name')).toHaveText(band.name)
    await expect(page.getByTestId('join-band-meta')).toContainText('Jon')
    await expect(page.getByTestId('join-band-meta')).toContainText('0 songs')
    await expect(page.getByTestId('join-not-now')).toBeVisible()
    await page.getByTestId('join-band-button').click()

    await page.waitForURL(url => url.pathname === '/', { timeout: 15000 })
    await page.goto('/band')
    await expect(page.getByTestId('band-title')).toContainText(band.name)
    await expect(page.getByTestId(`member-row-${guest.id}`)).toBeVisible()

    // Back on the link: already in.
    await page.goto(`/j/${band.code}`)
    await expect(page.getByTestId('join-already-member')).toBeVisible()
    await expect(page.getByTestId('join-open-band')).toBeVisible()
  })

  test('an invalid code says so without naming a band', async ({ page }) => {
    const user = await newUser('Ivy')
    await loginViaUI(page, user)
    await page.goto('/j/NOTACODE')
    await expect(page.getByTestId('join-invalid')).toContainText(
      "That code isn't valid any more. Ask the band for a new link."
    )
  })

  test('signed out, the link goes to sign in and back to the preview', async ({
    page,
  }) => {
    const owner = await newUser('Sol')
    const band = await bandWith(owner)
    const guest = await newUser('Sia')

    await page.goto(`/j/${band.code}`)
    await expect(page).toHaveURL(
      new RegExp(`/auth\\?returnTo=${encodeURIComponent(`/j/${band.code}`)}`)
    )
    await page.getByTestId('login-email-input').fill(guest.email)
    await page.getByTestId('login-password-input').fill(guest.password)
    await page.getByTestId('sign-in-button').click()
    await expect(page).toHaveURL(new RegExp(`/j/${band.code}$`), {
      timeout: 15000,
    })
    await expect(page.getByTestId('join-band-name')).toHaveText(band.name)
  })

  test.describe('phone', () => {
    test.use({ viewport: PHONE })

    test('Join sits in the dock', async ({ page }) => {
      const owner = await newUser('Dex')
      const band = await bandWith(owner)
      const guest = await newUser('Dot')
      await loginViaUI(page, guest)
      await page.goto(`/j/${band.code}`)
      const join = page.getByTestId('join-band-button')
      await expect(join).toBeVisible()
      await expect(page.getByTestId('phone-dock')).toContainText(
        `Join ${band.name}`
      )
      await join.click()
      await page.waitForURL(url => url.pathname === '/', { timeout: 15000 })
    })
  })
})

test.describe('Band profile', () => {
  test('owner edits city and genres in place; the mark picker saves', async ({
    page,
  }) => {
    const owner = await newUser('Pat')
    await bandWith(owner)
    await openBand(page, owner)
    await page.getByTestId('band-edit-info').click()
    await expect(page).toHaveURL(/\/band\/profile$/)

    const city = page.getByTestId('band-profile-city-input')
    await city.fill('Portland, OR')
    await city.press('Enter')
    await page.getByTestId('band-profile-genre-add').click()
    await page.getByTestId('band-profile-genre-input').fill('Shoegaze')
    await page.getByTestId('band-profile-genre-input').press('Enter')
    await expect(page.getByTestId('band-profile-genre')).toHaveText([
      'Shoegaze',
    ])

    await page.getByTestId('band-profile-link-add').click()
    await page.getByTestId('band-profile-link-label-input').fill('Bandcamp')
    await page
      .getByTestId('band-profile-link-url-input')
      .fill('patband.bandcamp.com')
    await page.getByTestId('band-profile-link-save').click()
    await expect(page.getByTestId('band-profile-link')).toContainText(
      'patband.bandcamp.com'
    )

    await page.getByTestId('band-profile-mark').click()
    await page.getByTestId('band-mark-kind-symbol').click()
    await page.getByTestId('band-mark-symbol-crown').click()
    await page.getByTestId('band-mark-color-wine').click()
    await page.getByTestId('band-mark-save').click()
    await expect(page.getByTestId('band-mark-picker')).toHaveCount(0)

    await page.reload()
    await expect(page.getByTestId('band-profile-city-input')).toHaveValue(
      'Portland, OR'
    )
    await expect(page.getByTestId('band-profile-genre')).toHaveText([
      'Shoegaze',
    ])
    await expect(
      page.getByTestId('band-profile-mark').locator('[data-mark-kind]')
    ).toHaveAttribute('data-mark-kind', 'symbol')
    // The switcher shows the same mark.
    await expect(
      page
        .getByTestId('context-switcher-trigger')
        .first()
        .locator('[data-mark-kind]')
    ).toHaveAttribute('data-mark-kind', 'symbol')
  })

  test.describe('phone', () => {
    test.use({ viewport: PHONE })

    test('a member reads the profile but cannot edit it', async ({ page }) => {
      const owner = await newUser('Ray')
      const mo = await newUser('Mo')
      await bandWith(owner, [{ user: mo }])
      await loginViaUI(page, mo)
      await page.goto('/band/profile')
      await expect(page.getByTestId('band-profile-name-input')).toHaveAttribute(
        'readonly',
        ''
      )
      await expect(page.getByTestId('band-profile-mark')).toBeDisabled()
      await expect(page.getByTestId('band-profile-genre-add')).toHaveCount(0)
    })
  })
})
