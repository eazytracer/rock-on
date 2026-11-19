import { BandMembership, InviteCode } from '../models/BandMembership'
import { repository } from './data/RepositoryFactory'
import { api } from './api/client'
import { ApiError } from './api/errors'
import * as bandsApi from './api/bands'
import type { InviteCodeRow, MembershipRow } from './api/bands'

const fromInviteRow = (r: InviteCodeRow): InviteCode => ({
  id: r.id,
  bandId: r.band_id,
  code: r.code,
  createdBy: r.created_by ?? '',
  expiresAt: r.expires_at ? new Date(r.expires_at) : undefined,
  maxUses: r.max_uses ?? undefined,
  currentUses: r.current_uses ?? 0,
  createdDate: new Date(r.created_date),
  isActive: r.is_active ?? false,
})

const fromMembershipRow = (r: MembershipRow): BandMembership => ({
  id: r.id,
  userId: r.user_id,
  bandId: r.band_id,
  role: r.role as BandMembership['role'],
  joinedDate: new Date(r.joined_date),
  status: r.status as BandMembership['status'],
  permissions: r.permissions ?? [],
})

/** The (band, user) pair the member RPCs take, from a membership id. */
async function membershipKey(
  membershipId: string
): Promise<{ bandId: string; userId: string }> {
  const { data, error } = await api()
    .from('band_memberships')
    .select('band_id, user_id')
    .eq('id', membershipId)
    .single()
  if (error) throw error
  return { bandId: data.band_id, userId: data.user_id }
}

export interface CreateInviteCodeRequest {
  bandId: string
  createdBy: string
  expiresAt?: Date
  maxUses?: number
}

export class BandMembershipService {
  /**
   * Issue a fresh invite code for a band (owner / admin). The band's previous
   * code stops working; codes last 24 h with unlimited uses (server rule).
   */
  static async createInviteCode(
    request: CreateInviteCodeRequest
  ): Promise<InviteCode> {
    return fromInviteRow(await bandsApi.regenerateInviteCode(request.bandId))
  }

  /**
   * Get all invite codes for a band
   */
  static async getBandInviteCodes(bandId: string): Promise<InviteCode[]> {
    return repository.getInviteCodes(bandId)
  }

  /**
   * Join a band using an invite code (join_band checks the code and that you
   * aren't already in). `userId` is kept for callers; the server uses the session.
   */
  static async joinBandWithCode(
    _userId: string,
    code: string
  ): Promise<{
    success: boolean
    membership?: BandMembership
    error?: string
  }> {
    try {
      return {
        success: true,
        membership: fromMembershipRow(await bandsApi.joinBand(code)),
      }
    } catch (err) {
      if (err instanceof ApiError && err.key !== 'unknown') {
        return { success: false, error: err.message }
      }
      throw err
    }
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
   * Leave a band. The owner is refused (transfer first, or delete the band).
   */
  static async leaveBand(_userId: string, bandId: string): Promise<void> {
    await bandsApi.leaveBand(bandId)
  }

  /** Remove a member from a band (owner / admin; never the owner). */
  static async removeMember(membershipId: string): Promise<void> {
    const { bandId, userId } = await membershipKey(membershipId)
    await bandsApi.removeMember(bandId, userId)
  }

  /**
   * Change a member's role. 'owner' transfers ownership (you become an admin,
   * in one server step).
   */
  static async updateMembershipRole(
    membershipId: string,
    role: 'owner' | 'admin' | 'member'
  ): Promise<void> {
    const { bandId, userId } = await membershipKey(membershipId)
    if (role === 'owner') await bandsApi.transferOwnership(bandId, userId)
    else await bandsApi.setMemberRole(bandId, userId, role)
  }

  /**
   * Delete an invite code
   */
  static async deleteInviteCode(inviteCodeId: string): Promise<void> {
    await repository.deleteInviteCode(inviteCodeId)
  }
}
