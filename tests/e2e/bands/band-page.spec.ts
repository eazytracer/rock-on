/**
 * The band page (`/band`, docs/redesign/13 · 6b): invite card + Regenerate,
 * member ⋯ by permission, transfer, leave / delete rules, More's band section.
 */
import { test, expect, Page } from '@playwright/test'
import { bandWith, newUser, openBand, PHONE } from './bandSetup'

const row = (page: Page, userId: string) =>
  page.getByTestId(`member-row-${userId}`)

async function confirm(page: Page) {
  await page.getByTestId('confirm-dialog-confirm').click()
}

test.describe('Band page · desktop', () => {
  test('owner sees the invite card; Regenerate kills the old code', async ({
    page,
  }) => {
    const owner = await newUser('Olive')
    const band = await bandWith(owner)
    await openBand(page, owner)

    const card = page.getByTestId('invite-card')
    await expect(card.getByTestId('invite-code')).toHaveText(band.code)
    await expect(card.getByTestId('invite-expiry')).toHaveText(
      /Expires in 2[34] h/
    )
    await expect(card.getByTestId('invite-link')).toContainText(
      `/j/${band.code}`
    )
    await card.getByTestId('invite-qr-toggle').click()
    await expect(
      card.getByTestId('invite-qr').locator('svg').first()
    ).toBeVisible()

    await card.getByTestId('invite-regenerate').click()
    await expect(page.getByTestId('confirm-dialog-message')).toContainText(
      'The old code and link stop working'
    )
    await confirm(page)
    await expect(card.getByTestId('invite-code')).not.toHaveText(band.code, {
      timeout: 10000,
    })

    // The old link now says so, without naming the band.
    await page.goto(`/j/${band.code}`)
    await expect(page.getByTestId('join-invalid')).toContainText(
      "That code isn't valid any more. Ask the band for a new link."
    )
    await expect(page.getByTestId('join-invalid')).not.toContainText(band.name)
  })

  test('owner makes a member an admin and back', async ({ page }) => {
    const owner = await newUser('Otto')
    const sam = await newUser('Sam')
    await bandWith(owner, [{ user: sam }])
    await openBand(page, owner)

    await expect(row(page, owner.id).getByTestId('member-role')).toHaveText(
      'owner'
    )
    await expect(row(page, sam.id).getByTestId('member-role')).toHaveCount(0)

    await page.getByTestId(`member-actions-${sam.id}`).click()
    await page.getByTestId('band-member-make-admin').click()
    await expect(row(page, sam.id).getByTestId('member-role')).toHaveText(
      'admin'
    )

    await page.getByTestId(`member-actions-${sam.id}`).click()
    await page.getByTestId('band-member-make-member').click()
    await expect(row(page, sam.id).getByTestId('member-role')).toHaveCount(0)
  })

  test('a plain member has no ⋯ on others and no invite card', async ({
    page,
  }) => {
    const owner = await newUser('Ona')
    const mia = await newUser('Mia')
    await bandWith(owner, [{ user: mia }])
    await openBand(page, mia)

    await expect(page.getByTestId(`member-actions-${owner.id}`)).toHaveCount(0)
    await expect(page.getByTestId('invite-card')).toHaveCount(0)
    await expect(page.getByTestId('band-delete')).toHaveCount(0)
    await expect(page.getByTestId('band-leave')).toBeVisible()
  })

  test('transfer is a plain confirm; the old owner becomes an admin', async ({
    page,
  }) => {
    const owner = await newUser('Theo')
    const tess = await newUser('Tess')
    await bandWith(owner, [{ user: tess }])
    await openBand(page, owner)

    await page.getByTestId(`member-actions-${tess.id}`).click()
    await page.getByTestId('band-member-transfer').click()
    await expect(page.getByTestId('confirm-dialog-typed-input')).toHaveCount(0)
    await expect(page.getByTestId('confirm-dialog-message')).toContainText(
      'You stay in the band as an admin'
    )
    await confirm(page)

    await expect(row(page, tess.id).getByTestId('member-role')).toHaveText(
      'owner',
      { timeout: 10000 }
    )
    await expect(row(page, owner.id).getByTestId('member-role')).toHaveText(
      'admin'
    )
    // No longer the owner: no Delete, Leave is a plain leave.
    await expect(page.getByTestId('band-delete')).toHaveCount(0)
  })

  test('owner with members tapping Leave is routed to transfer', async ({
    page,
  }) => {
    const owner = await newUser('Lena')
    const lou = await newUser('Lou')
    await bandWith(owner, [{ user: lou }])
    await openBand(page, owner)

    await page.getByTestId('band-leave').click()
    await expect(page.getByTestId('confirm-dialog-message')).toContainText(
      'transfer it first'
    )
    await confirm(page) // Transfer first (one other member → straight to its confirm)
    await expect(page.getByTestId('confirm-dialog-title')).toContainText(
      'Transfer'
    )
  })

  test('a member leaves and lands in Personal', async ({ page }) => {
    const owner = await newUser('Lars')
    const liv = await newUser('Liv')
    await bandWith(owner, [{ user: liv }])
    await openBand(page, liv)

    await page.getByTestId('band-leave').click()
    await confirm(page)
    await page.waitForURL(url => url.pathname === '/', { timeout: 15000 })
    expect(
      await page.evaluate(() => localStorage.getItem('rockon.context'))
    ).toBe('personal')
  })

  test('a sole owner gets Delete instead of Leave; delete needs the name typed', async ({
    page,
  }) => {
    const owner = await newUser('Dora')
    const band = await bandWith(owner)
    await openBand(page, owner)

    await expect(page.getByTestId('band-leave')).toHaveCount(0)
    await expect(page.getByTestId('band-transfer')).toHaveCount(0)
    await page.getByTestId('band-delete').click()
    const go = page.getByTestId('confirm-dialog-confirm')
    await expect(go).toBeDisabled()
    await page.getByTestId('confirm-dialog-typed-input').fill('wrong name')
    await expect(go).toBeDisabled()
    await page
      .getByTestId('confirm-dialog-typed-input')
      .fill(band.name.toLowerCase())
    await go.click()
    await page.waitForURL(url => url.pathname === '/', { timeout: 15000 })

    // Gone from the band list.
    await page.goto('/band')
    await expect(page.getByTestId('band-page-empty')).toBeVisible()
  })
})

test.describe('Band page · phone', () => {
  test.use({ viewport: PHONE })

  test('More shows the band section and opens the band, profile and invite', async ({
    page,
  }) => {
    const owner = await newUser('Mona')
    const max = await newUser('Max')
    const band = await bandWith(owner, [{ user: max }])
    await openBand(page, owner)

    await page.goto('/more')
    await expect(page.getByTestId('more-band-sub')).toContainText(
      'Owner · 2 members'
    )
    await expect(page.getByTestId('more-band-invite')).toContainText(band.code)
    await expect(page.getByTestId('more-theme-toggle')).toBeVisible()

    await page.getByTestId('more-band-profile').click()
    await expect(page).toHaveURL(/\/band\/profile$/)
    await page.goto('/more')
    await page.getByTestId('more-band-invite').click()
    await expect(page).toHaveURL(/\/band\?invite/)
    await expect(page.getByTestId('invite-code')).toHaveText(band.code)
  })

  test('member menu is a sheet; Remove asks first', async ({ page }) => {
    const owner = await newUser('Rae')
    const rob = await newUser('Rob')
    await bandWith(owner, [{ user: rob }])
    await openBand(page, owner)

    await page.getByTestId(`member-actions-${rob.id}`).click()
    await expect(page.getByTestId('band-member-sheet')).toBeVisible()
    await page.getByTestId('band-member-remove').click()
    await expect(page.getByTestId('confirm-dialog-title')).toContainText(
      'Remove'
    )
    await confirm(page)
    await expect(row(page, rob.id)).toHaveCount(0, { timeout: 10000 })
  })
})
