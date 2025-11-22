import { BandMembership, InviteCode } from '../models/BandMembership'
import { repository } from './data/RepositoryFactory'
import { RemoteRepository } from './data/RemoteRepository'

export interface CreateInviteCodeRequest {
  bandId: string
  createdBy: string
  expiresAt?: Date
  maxUses?: number
}

export class BandMembershipService {
  /**
   * Generate a random invite code (6 characters, alphanumeric)
   */
  private static generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude similar-looking chars
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  /**
   * Create an invite code for a band
   */
  static async createInviteCode(
    request: CreateInviteCodeRequest
  ): Promise<InviteCode> {
    const code = this.generateCode()

    // Check if code already exists (very unlikely but possible)
    const existingCode = await repository.getInviteCodeByCode(code)
    if (existingCode) {
      // Try again with a different code
      return this.createInviteCode(request)
    }

    const inviteCode: InviteCode = {
      id: crypto.randomUUID(),
      bandId: request.bandId,
      code,
      createdBy: request.createdBy,
      expiresAt: request.expiresAt,
      maxUses: request.maxUses || 10,
      isActive: true,
      currentUses: 0,
      createdDate: new Date(),
    }

    await repository.addInviteCode(inviteCode)
    return inviteCode
  }

  /**
   * Get all invite codes for a band
   */
  static async getBandInviteCodes(bandId: string): Promise<InviteCode[]> {
    return repository.getInviteCodes(bandId)
  }

  /**
   * Validate an invite code
   * Uses repository pattern (cloud-first read with local fallback)
   */
  static async validateInviteCode(code: string): Promise<{
    valid: boolean
    inviteCode?: InviteCode
    error?: string
  }> {
    // Repository handles Supabase-first → IndexedDB fallback automatically
    // Normalize code to uppercase for case-insensitive matching
    const inviteCode = await repository.getInviteCodeByCode(code.toUpperCase())

    if (!inviteCode) {
      return { valid: false, error: 'Invalid invite code' }
    }

    if (!inviteCode.isActive) {
      return { valid: false, error: 'Invite code is no longer active' }
    }

    if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
      return { valid: false, error: 'Invite code has expired' }
    }

    if (inviteCode.maxUses && inviteCode.currentUses >= inviteCode.maxUses) {
      return { valid: false, error: 'Invite code has reached maximum uses' }
    }

    return { valid: true, inviteCode }
  }

  /**
   * Join a band using an invite code
   */
  static async joinBandWithCode(
    userId: string,
    code: string
  ): Promise<{
    success: boolean
    membership?: BandMembership
    error?: string
  }> {
    console.log('[BandMembershipService] joinBandWithCode called:', {
      userId,
      code,
    })

    const validation = await this.validateInviteCode(code)
    console.log('[BandMembershipService] Validation result:', validation)

    if (!validation.valid || !validation.inviteCode) {
      console.log(
        '[BandMembershipService] Validation failed:',
        validation.error
      )
      return { success: false, error: validation.error }
    }

    const inviteCode = validation.inviteCode
    console.log('[BandMembershipService] Invite code valid:', inviteCode)

    // Check if user is already a member via repository
    console.log(
      '[BandMembershipService] Checking existing memberships for user:',
      userId
    )
    const userMemberships = await repository.getUserMemberships(userId)
    console.log('[BandMembershipService] User memberships:', userMemberships)

    const existingMembership = userMemberships.find(
      m => m.bandId === inviteCode.bandId
    )

    if (existingMembership) {
      console.log('[BandMembershipService] User already member')
      return { success: false, error: 'You are already a member of this band' }
    }

    // Create band membership via repository
    const membership: BandMembership = {
      id: crypto.randomUUID(),
      userId,
      bandId: inviteCode.bandId,
      role: 'member',
      joinedDate: new Date(),
      status: 'active',
      permissions: ['member'],
    }

    console.log('[BandMembershipService] Creating membership:', membership)
    try {
      // CRITICAL: Create in Supabase directly (bypass queue)
      // This ensures the membership exists in Supabase before subsequent queries
      // We DON'T add to LocalRepository here to avoid duplicates when pullFromRemote runs
      const remote = new RemoteRepository()

      // Create in remote Supabase (synchronously, not queued)
      await remote.addBandMembership(membership)
      console.log('[BandMembershipService] Membership created in Supabase')
    } catch (error) {
      console.error(
        '[BandMembershipService] Failed to create membership:',
        error
      )
      throw error
    }

    // Increment invite code usage via repository (uses secure Postgres function)
    console.log('[BandMembershipService] Incrementing invite code usage')
    try {
      await repository.incrementInviteCodeUsage(inviteCode.id)
      console.log('[BandMembershipService] Invite code usage incremented')
    } catch (error) {
      console.error('[BandMembershipService] Failed to increment usage:', error)
      throw error
    }

    // Now pull from remote to get the band data
    // The membership is already in Supabase, so getUserMemberships() will find it
    console.log('[BandMembershipService] Pulling band data from remote')
    try {
      await repository.pullFromRemote(userId)
      console.log('[BandMembershipService] Band data pulled successfully')
    } catch (error) {
      console.error('[BandMembershipService] Failed to pull band data:', error)
      // Don't fail the join if pull fails - membership is already created
    }

    console.log('[BandMembershipService] Join successful, returning membership')
    return { success: true, membership }
  }

  /**
   * Get all bands a user is a member of
   */
  static async getUserBands(userId: string): Promise<BandMembership[]> {
    const memberships = await repository.getUserMemberships(userId)
    // Filter for active memberships (client-side)
    return memberships.filter(m => m.status === 'active')
  }

  /**
   * Get all members of a band
   */
  static async getBandMembers(bandId: string): Promise<BandMembership[]> {
    const memberships = await repository.getBandMemberships(bandId)
    // Filter for active memberships (client-side)
    return memberships.filter(m => m.status === 'active')
  }

  /**
   * Leave a band
   */
  static async leaveBand(userId: string, bandId: string): Promise<void> {
    // Get user memberships via repository
    const userMemberships = await repository.getUserMemberships(userId)
    const membership = userMemberships.find(
      m => m.userId === userId && m.bandId === bandId
    )

    if (!membership) {
      throw new Error('Membership not found')
    }

    // Check if user is the last admin
    if (membership.role === 'admin') {
      const allMembers = await this.getBandMembers(bandId)
      const admins = allMembers.filter(m => m.role === 'admin')

      if (admins.length <= 1) {
        throw new Error(
          'Cannot leave: you are the last admin. Please promote another member first.'
        )
      }
    }

    await repository.updateBandMembership(membership.id, { status: 'inactive' })
  }

  /**
   * Update membership role
   */
  static async updateMembershipRole(
    membershipId: string,
    role: 'admin' | 'member' | 'viewer'
  ): Promise<void> {
    await repository.updateBandMembership(membershipId, { role })
  }

  /**
   * Delete an invite code
   */
  static async deleteInviteCode(inviteCodeId: string): Promise<void> {
    await repository.deleteInviteCode(inviteCodeId)
  }
}
