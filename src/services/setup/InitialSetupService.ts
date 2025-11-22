import { db } from '../database'
import { BandService } from '../BandService'
import { BandMembershipService } from '../BandMembershipService'

export interface InitialSetupOptions {
  userId: string
  userName: string
  createDefaultBand?: boolean
}

export class InitialSetupService {
  /**
   * Check if user has completed initial setup
   */
  static async hasCompletedSetup(userId: string): Promise<boolean> {
    // Check if user has any band memberships
    const memberships = await BandMembershipService.getUserBands(userId)
    return memberships.length > 0
  }

  /**
   * Create a default band for a new user
   */
  static async createDefaultBand(
    userId: string,
    userName: string
  ): Promise<{ bandId: string; membershipId: string }> {
    // Create default band
    const band = await BandService.createBand({
      name: `${userName}'s Band`,
      description: 'My awesome band',
    })

    // Create admin membership for the user
    const membership: any = {
      id: crypto.randomUUID(),
      userId,
      bandId: band.id,
      role: 'admin',
      joinedDate: new Date(),
      status: 'active',
      permissions: ['admin', 'member'],
    }

    await db.bandMemberships.add(membership)

    return {
      bandId: band.id,
      membershipId: membership.id,
    }
  }

  /**
   * Perform initial setup for a new user
   */
  static async performInitialSetup(
    options: InitialSetupOptions
  ): Promise<void> {
    const { userId, userName, createDefaultBand = true } = options

    // Check if setup already completed
    const hasSetup = await this.hasCompletedSetup(userId)
    if (hasSetup) {
      console.log('User already has completed setup')
      return
    }

    // Create default band if requested
    if (createDefaultBand) {
      await this.createDefaultBand(userId, userName)
      console.log('Created default band for user:', userName)
    }
  }

  /**
   * Get user's default/first band
   */
  static async getUserDefaultBand(userId: string): Promise<string | null> {
    const memberships = await BandMembershipService.getUserBands(userId)

    if (memberships.length === 0) {
      return null
    }

    // Return the first band (usually the one created during setup)
    // or the first admin band if multiple exist
    const adminMembership = memberships.find(m => m.role === 'admin')
    return adminMembership ? adminMembership.bandId : memberships[0].bandId
  }

  /**
   * Reset user's setup (for testing purposes)
   */
  static async resetUserSetup(userId: string): Promise<void> {
    // Remove all band memberships
    const memberships = await db.bandMemberships
      .where('userId')
      .equals(userId)
      .toArray()

    for (const membership of memberships) {
      await db.bandMemberships.delete(membership.id)
    }

    console.log('Reset setup for user:', userId)
  }
}
