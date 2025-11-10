import { db } from './database'
import { BandMembership, InviteCode } from '../models/BandMembership'
import { repository } from './data/RepositoryFactory'
import { supabase } from './supabase/client'

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
      isActive: true,
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
   * Queries Supabase (server) first, falls back to IndexedDB for offline support
   */
  static async validateInviteCode(code: string): Promise<{
    valid: boolean
    inviteCode?: InviteCode
    error?: string
  }> {
    const upperCode = code.toUpperCase()
    let inviteCode: InviteCode | null = null

    // Try to query Supabase first (server-side, allows cross-user validation)
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('invite_codes')
          .select('*')
          .eq('code', upperCode)
          .eq('is_active', true)
          .single()

        if (!error && data) {
          // Map from Supabase snake_case to application camelCase
          inviteCode = {
            id: (data as any).id,
            bandId: (data as any).band_id,
            code: (data as any).code,
            createdBy: (data as any).created_by,
            expiresAt: (data as any).expires_at ? new Date((data as any).expires_at) : undefined,
            maxUses: (data as any).max_uses,
            currentUses: (data as any).current_uses,
            createdDate: new Date((data as any).created_date),
            isActive: (data as any).is_active
          }
        }
      }
    } catch (error) {
      console.warn('Failed to query Supabase for invite code, falling back to IndexedDB:', error)
    }

    // Fallback to IndexedDB if Supabase query failed or returned no results
    if (!inviteCode) {
      inviteCode = await db.inviteCodes.where('code').equals(upperCode).first() || null
    }

    if (!inviteCode) {
      return { valid: false, error: 'Invalid invite code' }
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
  ): Promise<{ success: boolean; membership?: BandMembership; error?: string }> {
    const validation = await this.validateInviteCode(code)

    if (!validation.valid || !validation.inviteCode) {
      return { success: false, error: validation.error }
    }

    const inviteCode = validation.inviteCode

    // Check if user is already a member via repository
    const userMemberships = await repository.getUserMemberships(userId)
    const existingMembership = userMemberships.find(
      (m) => m.bandId === inviteCode.bandId
    )

    if (existingMembership) {
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
      permissions: ['member']
    }

    await repository.addBandMembership(membership)

    // Increment invite code usage (still using db.inviteCodes - not yet in repository)
    await db.inviteCodes.update(inviteCode.id, {
      currentUses: inviteCode.currentUses + 1
    })

    return { success: true, membership }
  }

  /**
   * Get all bands a user is a member of
   */
  static async getUserBands(userId: string): Promise<BandMembership[]> {
    const memberships = await repository.getUserMemberships(userId)
    // Filter for active memberships (client-side)
    return memberships.filter((m) => m.status === 'active')
  }

  /**
   * Get all members of a band
   */
  static async getBandMembers(bandId: string): Promise<BandMembership[]> {
    const memberships = await repository.getBandMemberships(bandId)
    // Filter for active memberships (client-side)
    return memberships.filter((m) => m.status === 'active')
  }

  /**
   * Leave a band
   */
  static async leaveBand(userId: string, bandId: string): Promise<void> {
    // Get user memberships via repository
    const userMemberships = await repository.getUserMemberships(userId)
    const membership = userMemberships.find(
      (m) => m.userId === userId && m.bandId === bandId
    )

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
    await db.inviteCodes.delete(inviteCodeId)
  }
}
