import { db } from './database'
import { BandMembership, InviteCode } from '../models/BandMembership'

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
  static async createInviteCode(request: CreateInviteCodeRequest): Promise<InviteCode> {
    const code = this.generateCode()

    // Check if code already exists (very unlikely but possible)
    const existingCode = await db.inviteCodes.where('code').equals(code).first()
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
      currentUses: 0,
      createdDate: new Date()
    }

    await db.inviteCodes.add(inviteCode)
    return inviteCode
  }

  /**
   * Get all invite codes for a band
   */
  static async getBandInviteCodes(bandId: string): Promise<InviteCode[]> {
    return db.inviteCodes.where('bandId').equals(bandId).toArray()
  }

  /**
   * Validate an invite code
   */
  static async validateInviteCode(code: string): Promise<{
    valid: boolean
    inviteCode?: InviteCode
    error?: string
  }> {
    const inviteCode = await db.inviteCodes.where('code').equals(code.toUpperCase()).first()

    if (!inviteCode) {
      return { valid: false, error: 'Invalid invite code' }
    }

    if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
      return { valid: false, error: 'Invite code has expired' }
    }

    if (inviteCode.currentUses >= inviteCode.maxUses) {
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
  ): Promise<{ success: boolean; membership?: BandMembership; error?: string }> {
    const validation = await this.validateInviteCode(code)

    if (!validation.valid || !validation.inviteCode) {
      return { success: false, error: validation.error }
    }

    const inviteCode = validation.inviteCode

    // Check if user is already a member
    const existingMembership = await db.bandMemberships
      .where(['userId', 'bandId'])
      .equals([userId, inviteCode.bandId])
      .first()

    if (existingMembership) {
      return { success: false, error: 'You are already a member of this band' }
    }

    // Create band membership
    const membership: BandMembership = {
      id: crypto.randomUUID(),
      userId,
      bandId: inviteCode.bandId,
      role: 'member',
      joinedDate: new Date(),
      status: 'active',
      permissions: ['member']
    }

    await db.bandMemberships.add(membership)

    // Increment invite code usage
    await db.inviteCodes.update(inviteCode.id, {
      currentUses: inviteCode.currentUses + 1
    })

    return { success: true, membership }
  }

  /**
   * Get all bands a user is a member of
   */
  static async getUserBands(userId: string): Promise<BandMembership[]> {
    return db.bandMemberships
      .where('userId')
      .equals(userId)
      .filter((m) => m.status === 'active')
      .toArray()
  }

  /**
   * Get all members of a band
   */
  static async getBandMembers(bandId: string): Promise<BandMembership[]> {
    return db.bandMemberships
      .where('bandId')
      .equals(bandId)
      .filter((m) => m.status === 'active')
      .toArray()
  }

  /**
   * Leave a band
   */
  static async leaveBand(userId: string, bandId: string): Promise<void> {
    const membership = await db.bandMemberships
      .where(['userId', 'bandId'])
      .equals([userId, bandId])
      .first()

    if (!membership) {
      throw new Error('Membership not found')
    }

    // Check if user is the last admin
    if (membership.role === 'admin') {
      const allMembers = await this.getBandMembers(bandId)
      const admins = allMembers.filter((m) => m.role === 'admin')

      if (admins.length <= 1) {
        throw new Error('Cannot leave: you are the last admin. Please promote another member first.')
      }
    }

    await db.bandMemberships.update(membership.id, { status: 'inactive' })
  }

  /**
   * Update membership role
   */
  static async updateMembershipRole(
    membershipId: string,
    role: 'admin' | 'member' | 'viewer'
  ): Promise<void> {
    await db.bandMemberships.update(membershipId, { role })
  }

  /**
   * Delete an invite code
   */
  static async deleteInviteCode(inviteCodeId: string): Promise<void> {
    await db.inviteCodes.delete(inviteCodeId)
  }
}
